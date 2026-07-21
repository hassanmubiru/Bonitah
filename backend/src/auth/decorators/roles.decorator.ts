import { type CustomDecorator, SetMetadata } from '@nestjs/common';

import type { Role } from '../auth.types';

/** Reflector metadata key carrying the roles permitted to invoke a handler. */
export const ROLES_KEY = 'bfn:roles';

/**
 * Restrict an endpoint (or controller) to one or more authorization roles
 * (Req 14.9). The globally-registered {@link RolesGuard} allows the request only
 * when the authenticated session's role is one of the listed roles. Handlers
 * without this decorator impose no role restriction beyond authentication.
 *
 * @param roles  The roles permitted to access the decorated handler.
 */
export const Roles = (...roles: Role[]): CustomDecorator<string> => SetMetadata(ROLES_KEY, roles);
