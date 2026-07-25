import { Body, Controller, Get, HttpCode, HttpStatus, Post, Request } from '@nestjs/common';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedRequest } from './auth.types';
import {
  type LogoutResponse,
  type MeResponse,
  type NonceRequest,
  type NonceResponse,
  nonceRequestSchema,
  type VerifyRequest,
  type VerifyResponse,
  verifyRequestSchema,
} from './auth.schemas';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';

/**
 * SIWE authentication endpoints (Req 2.4, 2.6–2.10, 14.1).
 *
 * Every handler is marked {@link Public} because these routes must be reachable
 * before a session exists — they are the only way to obtain one. The global
 * {@link file://./guards/jwt-auth.guard.ts JwtAuthGuard} therefore skips them,
 * while all other backend routes remain authenticated by default.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Issue a single-use, expiry-bounded nonce for the given wallet (Req 2.4).
   */
  @Public()
  @Post('nonce')
  @HttpCode(HttpStatus.OK)
  issueNonce(
    @Body(new ZodValidationPipe(nonceRequestSchema)) body: NonceRequest,
  ): Promise<NonceResponse> {
    return this.authService.issueNonce(body);
  }

  /**
   * Verify a signed SIWE message and establish a session (Req 2.6–2.10).
   */
  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify(
    @Body(new ZodValidationPipe(verifyRequestSchema)) body: VerifyRequest,
  ): Promise<VerifyResponse> {
    return this.authService.verify(body);
  }

  /**
   * End the caller's session (client-side stateless-JWT discard).
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(): LogoutResponse {
    return this.authService.logout();
  }

  /**
   * Get current authenticated user information (Req 14.9).
   * 
   * Returns user ID, address, and role from the JWT session.
   * Requires valid authentication.
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  me(@Request() req: AuthenticatedRequest): MeResponse {
    return this.authService.me(req.user.userId, req.user.address, req.user.role);
  }
}
