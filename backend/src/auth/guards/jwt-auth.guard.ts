import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedUser, AuthenticatedRequest } from '../auth.types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TokenService } from '../token.service';

/**
 * Global authentication guard (Req 14.1, 14.2).
 *
 * Requires a valid, unexpired session JWT (as a `Bearer` token) for every
 * request except handlers explicitly marked `@Public()`. The decoded principal
 * is attached to `request.user` for downstream role checks and handlers. Any
 * missing, malformed, or expired token is rejected with an authentication error
 * before the handler runs, so no protected work is performed (Req 14.2).
 *
 * Registered as an `APP_GUARD` in {@link AuthModule}, ahead of {@link RolesGuard}.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Valid authentication is required');
    }

    const payload = this.tokenService.verify(token);

    const user: AuthenticatedUser = {
      userId: payload.userId,
      address: (payload.address ?? payload.sub).toLowerCase(),
      role: payload.role,
    };
    request.user = user;

    return true;
  }
}

/** Extract the token from an `Authorization: Bearer <token>` header. */
function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization) {
    return undefined;
  }
  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return undefined;
  }
  return token.trim() || undefined;
}
