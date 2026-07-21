import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { AuthModule } from './auth/auth.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { LoggingModule } from './logging/logging.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Root application module.
 *
 * Assembles the cross-cutting infrastructure for the backend:
 * - {@link ConfigModule}: validated, typed environment configuration.
 * - {@link LoggingModule}: structured JSON logging with request ids.
 * - {@link PrismaModule}: connection-managed database access (off-chain data
 *   plus provenanced cache only, Req 1.3).
 * - {@link AuthModule}: global JWT authentication + role authorization guards.
 * - {@link HealthModule}: liveness/readiness endpoints.
 * - {@link HttpExceptionFilter}: registered globally so every error returns a
 *   consistent, correlatable, secret-free envelope.
 *
 * Feature modules (SIWE auth endpoints, indexer, AI, IPFS, etc.) are added in
 * later tasks and inherit the global guards registered by {@link AuthModule}.
 */
@Module({
  imports: [ConfigModule, LoggingModule, PrismaModule, AuthModule, HealthModule],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
