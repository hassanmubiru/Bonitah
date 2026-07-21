import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../auth.types';

/**
 * Inject the authenticated principal established by {@link JwtAuthGuard}.
 *
 * Resolves to the {@link AuthenticatedUser} attached to the request after a
 * valid session JWT is verified. On public routes (no authentication) this is
 * `undefined`, so consumers on protected routes can treat it as always present.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user;
  },
);
