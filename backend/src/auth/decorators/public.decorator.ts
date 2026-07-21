import { type CustomDecorator, SetMetadata } from '@nestjs/common';

/** Reflector metadata key marking a route (or controller) as public. */
export const IS_PUBLIC_KEY = 'bfn:isPublic';

/**
 * Mark an endpoint or controller as public (Req 14.1).
 *
 * The globally-registered {@link JwtAuthGuard} skips authentication for handlers
 * carrying this metadata. Everything not marked `@Public()` requires a valid,
 * unexpired session JWT. Use sparingly — only for the nonce/verify and health
 * endpoints that must be reachable before a session exists.
 */
export const Public = (): CustomDecorator<string> => SetMetadata(IS_PUBLIC_KEY, true);
