/**
 * Public surface of the auth/security foundation.
 *
 * Feature modules import guards' companion decorators (`@Public`, `@Roles`,
 * `@CurrentUser`), the `TokenService`, and shared auth types from here.
 */
export { AuthModule } from './auth.module';
export { TokenService, type SignableClaims } from './token.service';
export { JwtAuthGuard } from './guards/jwt-auth.guard';
export { RolesGuard } from './guards/roles.guard';
export { Public, IS_PUBLIC_KEY } from './decorators/public.decorator';
export { Roles, ROLES_KEY } from './decorators/roles.decorator';
export { CurrentUser } from './decorators/current-user.decorator';
export {
  ROLES,
  DEFAULT_ROLE,
  jwtPayloadSchema,
  type Role,
  type JwtPayload,
  type AuthenticatedUser,
} from './auth.types';
