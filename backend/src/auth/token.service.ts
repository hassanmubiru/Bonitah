import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';

import { EnvService } from '../config/env.service';
import { type JwtPayload, jwtPayloadSchema } from './auth.types';

/** Fixed JOSE header for the HS256 sessions BFN issues. */
const HS256_HEADER = { alg: 'HS256', typ: 'JWT' } as const;

/** Claims callers supply; `iat`/`exp` are stamped by {@link TokenService.sign}. */
export type SignableClaims = Omit<JwtPayload, 'iat' | 'exp'>;

/**
 * Self-contained session-token service (Req 2.7, 14.1, 14.2).
 *
 * Signs and verifies compact JWS (JWT) tokens using HMAC-SHA256 over the
 * validated `JWT_SECRET`. It deliberately depends only on Node's built-in
 * `crypto` so the auth/security layer is self-contained and carries no
 * third-party JWT dependency. Signatures are compared in constant time and
 * every token must carry an `exp` claim, so expired or tampered tokens are
 * rejected uniformly with an authentication error (Req 14.2).
 */
@Injectable()
export class TokenService {
  private readonly secret: string;

  constructor(env: EnvService) {
    this.secret = env.jwtSecret;
  }

  /**
   * Issue a signed session JWT.
   *
   * @param claims  Identity/role claims for the session.
   * @param expiresInSeconds  Lifetime in seconds; capped by the caller to the
   *   24h maximum session length (Req 2.7). Must be positive.
   * @returns A compact `header.payload.signature` token.
   */
  sign(claims: SignableClaims, expiresInSeconds: number): string {
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds <= 0) {
      throw new Error('expiresInSeconds must be a positive integer');
    }

    const issuedAt = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
      ...claims,
      iat: issuedAt,
      exp: issuedAt + expiresInSeconds,
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(HS256_HEADER));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = this.signingSignature(signingInput);

    return `${signingInput}.${signature}`;
  }

  /**
   * Verify and decode a session JWT.
   *
   * Rejects tokens that are malformed, use an unexpected algorithm, carry an
   * invalid signature, fail payload-shape validation, or are expired.
   *
   * @throws UnauthorizedException with a generic, secret-free message on any
   * verification failure (Req 14.2).
   */
  verify(token: string): JwtPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw invalidToken();
    }

    const [encodedHeader, encodedPayload, providedSignature] = parts as [string, string, string];

    this.assertHeader(encodedHeader);

    const expectedSignature = this.signingSignature(`${encodedHeader}.${encodedPayload}`);
    if (!constantTimeEquals(providedSignature, expectedSignature)) {
      throw invalidToken();
    }

    const payload = this.decodePayload(encodedPayload);

    // Reject expired sessions (Req 2.9, 14.2). `exp` presence is enforced by
    // the payload schema, so every accepted token is expiry-bounded.
    const now = Math.floor(Date.now() / 1000);
    if (now >= payload.exp) {
      throw invalidToken();
    }

    return payload;
  }

  private assertHeader(encodedHeader: string): void {
    let header: unknown;
    try {
      header = JSON.parse(base64UrlDecode(encodedHeader));
    } catch {
      throw invalidToken();
    }
    const alg = (header as Record<string, unknown> | null)?.['alg'];
    if (alg !== HS256_HEADER.alg) {
      throw invalidToken();
    }
  }

  private decodePayload(encodedPayload: string): JwtPayload {
    let raw: unknown;
    try {
      raw = JSON.parse(base64UrlDecode(encodedPayload));
    } catch {
      throw invalidToken();
    }
    const parsed = jwtPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      throw invalidToken();
    }
    return parsed.data;
  }

  private signingSignature(signingInput: string): string {
    return createHmac('sha256', this.secret).update(signingInput).digest('base64url');
  }
}

/** Generic, secret-free authentication error (Req 14.2). */
function invalidToken(): UnauthorizedException {
  return new UnauthorizedException('Valid authentication is required');
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

/** Constant-time comparison of two base64url signature strings. */
function constantTimeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}
