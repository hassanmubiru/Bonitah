import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TokenService } from './token.service';

/**
 * Security/auth foundation module (Req 14.1, 14.2, 14.9).
 *
 * Registers, in order, two global guards on top of every route:
 *  1. {@link JwtAuthGuard} — requires a valid session JWT unless `@Public()`.
 *  2. {@link RolesGuard}   — enforces `@Roles(...)` restrictions.
 *
 * Because Nest applies globally-provided guards in registration order, requests
 * are authenticated before roles are checked, so `request.user` is populated by
 * the time {@link RolesGuard} runs. The {@link TokenService} is exported (and the
 * module is {@link Global}) so the SIWE auth module added later can issue tokens
 * with the same verified configuration.
 */
@Global()
@Module({
  providers: [
    TokenService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [TokenService],
})
export class AuthModule {}
