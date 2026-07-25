import { randomBytes } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SiweMessage } from 'siwe';
import { verifyMessage } from 'viem';

import { EnvService } from '../config/env.service';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_ROLE, type Role } from './auth.types';
import type {
  LogoutResponse,
  MeResponse,
  NonceRequest,
  NonceResponse,
  VerifyRequest,
  VerifyResponse,
} from './auth.schemas';
import { TokenService } from './token.service';

/** Lifetime of an issued sign-in nonce before it expires (Req 2.4, 2.6). */
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Hard upper bound on a session's lifetime (Req 2.7): 24 hours in seconds. */
const MAX_SESSION_SECONDS = 24 * 60 * 60;

/**
 * Sign-In With Ethereum (SIWE) authentication service (Req 2.4, 2.6–2.10, 14.1).
 *
 * Implements the wallet-based, passwordless sign-in flow:
 *  1. {@link issueNonce} mints a single-use, expiry-bounded nonce persisted via
 *     Prisma so the frontend can embed it in a SIWE message (Req 2.4).
 *  2. {@link verify} verifies the signed SIWE message against the claimed wallet
 *     address, validates the nonce is unused and unexpired, atomically consumes
 *     the nonce so it can never be reused, upserts the wallet's off-chain user
 *     record with a least-privilege default role, and issues a session JWT whose
 *     expiry never exceeds 24 hours (Req 2.6–2.10).
 *  3. {@link logout} ends the client session; sessions are stateless JWTs, so the
 *     client discards the token.
 *
 * The blockchain remains the source of truth for financial state; this service
 * only persists off-chain identity/authorization data (Req 1.3).
 */
@Injectable()
export class AuthService {
  private readonly sessionSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    env: EnvService,
  ) {
    this.sessionSeconds = parseSessionSeconds(env.jwtExpiresIn);
  }

  /**
   * Issue a single-use, expiry-bounded sign-in nonce for a wallet (Req 2.4).
   *
   * The nonce is persisted (unused, with an expiry timestamp) and returned to
   * the caller to embed in the SIWE message it will sign.
   */
  async issueNonce(input: NonceRequest): Promise<NonceResponse> {
    const address = input.address.toLowerCase();
    // 16 random bytes -> 32 hex chars: comfortably above the 8-char minimum and
    // large enough to be unguessable and collision-free in practice.
    const nonce = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + NONCE_TTL_MS);

    await this.prisma.authNonce.create({
      data: { nonce, address, expiresAt },
    });

    return { nonce };
  }

  /**
   * Verify a signed SIWE message and establish a session (Req 2.6–2.10).
   *
   * Rejects with a generic authentication error when the signature is invalid,
   * the recovered address does not match the message address, or the message's
   * nonce is unknown, already used, expired, or bound to a different address
   * (Req 2.8). On success it consumes the nonce, upserts the user with the
   * least-privilege default role, and returns a JWT plus its expiry (Req 2.7).
   */
  async verify(input: VerifyRequest): Promise<VerifyResponse> {
    let siwe: SiweMessage;
    try {
      siwe = new SiweMessage(input.message);
    } catch {
      throw invalidAuth();
    }

    const address = siwe.address.toLowerCase();

    // Cryptographic verification: recover/validate the signer against the
    // address claimed in the SIWE message (Req 2.6, 2.8) using viem.
    let signatureValid: boolean;
    try {
      signatureValid = await verifyMessage({
        address: siwe.address as `0x${string}`,
        message: siwe.prepareMessage(),
        signature: input.signature as `0x${string}`,
      });
    } catch {
      throw invalidAuth();
    }
    if (!signatureValid) {
      throw invalidAuth();
    }

    // Enforce the message's own expiration time when present (Req 2.4).
    if (siwe.expirationTime && Date.parse(siwe.expirationTime) <= Date.now()) {
      throw invalidAuth();
    }

    // The message nonce must correspond to an issued nonce that is unused,
    // unexpired, and bound to the same wallet address (Req 2.6, 2.8).
    const record = await this.prisma.authNonce.findUnique({
      where: { nonce: siwe.nonce },
    });
    if (
      !record ||
      record.used ||
      record.address.toLowerCase() !== address ||
      record.expiresAt.getTime() <= Date.now()
    ) {
      throw invalidAuth();
    }

    // Atomically consume the nonce so it can never be reused, even under
    // concurrent verification attempts (Req 2.7). The `used: false` guard means
    // exactly one caller can transition it; a count of 0 indicates a race lost.
    const consumed = await this.prisma.authNonce.updateMany({
      where: { nonce: siwe.nonce, used: false },
      data: { used: true },
    });
    if (consumed.count !== 1) {
      throw invalidAuth();
    }

    // Upsert the off-chain user record with the least-privilege default role for
    // new wallets; existing wallets retain their assigned role (Req 2.10).
    const user = await this.prisma.user.upsert({
      where: { walletAddress: address },
      create: { walletAddress: address, role: DEFAULT_ROLE },
      update: {},
    });

    // Issue a session JWT whose lifetime never exceeds 24 hours (Req 2.7).
    const issuedAt = Math.floor(Date.now() / 1000);
    const token = this.tokenService.sign(
      { sub: address, address, userId: user.id, role: user.role as Role },
      this.sessionSeconds,
    );
    const expiresAt = new Date((issuedAt + this.sessionSeconds) * 1000).toISOString();

    return {
      jwt: token,
      address,
      role: user.role as Role,
      expiresAt,
    };
  }

  /**
   * End the caller's session (Req 2.x logout).
   *
   * Sessions are represented by stateless, expiry-bounded JWTs with no
   * server-side session store, so logout is a client-side token discard. The
   * endpoint acknowledges the request so the frontend can clear its stored
   * token deterministically.
   */
  logout(): LogoutResponse {
    return { success: true };
  }

  /**
   * Get current user information from the authenticated session (Req 14.9).
   *
   * Returns the user ID, address, and role from the authenticated principal.
   * This endpoint requires valid authentication.
   */
  me(userId: string, address: string, role: Role): MeResponse {
    return { userId, address, role };
  }
}

/** Generic, detail-free authentication error (Req 2.8, 14.2). */
function invalidAuth(): UnauthorizedException {
  return new UnauthorizedException('Authentication failed');
}

/**
 * Parse a configured session lifetime (e.g. `24h`, `30m`, `3600s`, `1d`, or a
 * plain seconds count) into seconds, clamped to the 24-hour maximum (Req 2.7).
 * Falls back to the maximum when the value cannot be parsed.
 */
export function parseSessionSeconds(value: string): number {
  const match = /^(\d+)\s*(s|m|h|d)?$/.exec(value.trim());
  if (!match) {
    return MAX_SESSION_SECONDS;
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  const unitSeconds: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };
  const seconds = amount * (unitSeconds[unit] ?? 1);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return MAX_SESSION_SECONDS;
  }

  return Math.min(seconds, MAX_SESSION_SECONDS);
}
