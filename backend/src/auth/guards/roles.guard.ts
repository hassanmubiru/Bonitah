import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest, Role } from '../auth.types';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Global role-based authorization guard (Req 14.9).
 *
 * Runs after {@link JwtAuthGuard}. For handlers annotated with `@Roles(...)`, it
 * permits the request only when the authenticated session's role is one of the
 * permitted roles; otherwise it rejects with a forbidden error and no handler
 * work occurs. Handlers without `@Roles(...)` impose no additional role
 * restriction. Access is granted strictly by explicit membership — no role is
 * an implicit superuser — enforcing least privilege (Req 14.9).
 *
 * Registered as an `APP_GUARD` in {@link AuthModule}, after {@link JwtAuthGuard}.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No role restriction declared: authentication (handled upstream) suffices.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    // A role-restricted route requires an authenticated principal. Absence here
    // means the route was reachable without authentication (e.g. mistakenly
    // marked @Public); deny rather than leak access.
    if (!user) {
      throw new ForbiddenException('Insufficient role for this operation');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role for this operation');
    }

    return true;
  }
}
