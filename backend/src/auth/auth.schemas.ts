import { z } from 'zod';

import { ROLES } from './auth.types';

/**
 * Request/response schemas for the SIWE auth endpoints (Req 2.4, 2.6–2.10).
 *
 * These deliberately mirror the `nonceRequest/Response` and
 * `verifyRequest/Response` schemas exported by `@bfn/shared`, but are declared
 * locally so the auth layer stays self-contained with no cross-package runtime
 * import — the same convention already followed by {@link file://./auth.types.ts}
 * for the role set. Keeping the shapes identical preserves the single API
 * contract the frontend consumes from `@bfn/shared`.
 */

/** 0x-prefixed 20-byte Ethereum address. */
const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'must be a 0x-prefixed 20-byte address');

/** Arbitrary-length 0x-prefixed hex string (e.g. a signature). */
const hexSchema = z.string().regex(/^0x[0-9a-fA-F]*$/, 'must be a 0x-prefixed hex string');

/** POST /auth/nonce request. */
export const nonceRequestSchema = z.object({
  address: addressSchema,
});
export type NonceRequest = z.infer<typeof nonceRequestSchema>;

/** POST /auth/nonce response. */
export const nonceResponseSchema = z.object({
  nonce: z.string().min(8),
});
export type NonceResponse = z.infer<typeof nonceResponseSchema>;

/** POST /auth/verify request — the signed SIWE message and its signature. */
export const verifyRequestSchema = z.object({
  message: z.string().min(1),
  signature: hexSchema,
});
export type VerifyRequest = z.infer<typeof verifyRequestSchema>;

/** POST /auth/verify response — the issued session (Req 2.7, 2.8). */
export const verifyResponseSchema = z.object({
  jwt: z.string().min(1),
  address: addressSchema,
  role: z.enum(ROLES),
  expiresAt: z.string().datetime(),
});
export type VerifyResponse = z.infer<typeof verifyResponseSchema>;

/** POST /auth/logout response. */
export interface LogoutResponse {
  readonly success: true;
}
