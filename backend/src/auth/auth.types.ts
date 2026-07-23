import { Request } from 'express';
import { z } from 'zod';

/**
 * Off-chain authorization roles (Req 2.10, 14.9).
 *
 * Mirrors the `Role` enum in the Prisma schema and the `roleSchema` in
 * `@bfn/shared`. Declared locally so the security primitives stay dependency-
 * free and self-contained (no cross-package runtime import required).
 */
export const ROLES = ['USER', 'VERIFIER', 'ADMIN'] as const;

/** A single authorization role. */
export type Role = (typeof ROLES)[number];

/** Least-privilege default role assigned to newly authenticated wallets (Req 2.10). */
export const DEFAULT_ROLE: Role = 'USER';

/**
 * Validated shape of a decoded session JWT payload (Req 2.7).
 *
 * - `sub`/`address`: the authenticated wallet address the session identifies.
 * - `userId`: the database user ID for off-chain data access.
 * - `role`: the authorization role used for role checks.
 * - `iat`/`exp`: standard issued-at / expiry claims (seconds since epoch). An
 *   `exp` claim is mandatory so every session is expiry-bounded (Req 2.7, 14.2).
 */
export const jwtPayloadSchema = z.object({
  sub: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'sub must be a 0x-prefixed address'),
  address: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'address must be a 0x-prefixed address')
    .optional(),
  userId: z.string().cuid(),
  role: z.enum(ROLES),
  iat: z.number().int().nonnegative().optional(),
  exp: z.number().int().positive(),
});

/** Decoded, validated JWT payload. */
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;

/**
 * The authenticated principal attached to `request.user` by {@link JwtAuthGuard}
 * after a valid session JWT is verified. Downstream handlers and guards read it
 * for identity and authorization decisions.
 */
export interface AuthenticatedUser {
  /** Database user ID for off-chain data access. */
  readonly userId: string;
  /** Authenticated wallet address (lowercased for stable comparison). */
  readonly address: string;
  /** Authorization role carried by the session. */
  readonly role: Role;
}

/**
 * Express request augmented with authenticated user information.
 * 
 * The JwtAuthGuard populates `req.user` with the authenticated principal
 * for protected endpoints.
 */
export interface AuthenticatedRequest extends Request {
  /** Authenticated user information extracted from valid JWT. */
  user: AuthenticatedUser;
}
