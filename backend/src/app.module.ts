import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { ChainReadModule } from './chain-read/chain-read.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ConfigModule } from './config/config.module';
import { EducationModule } from './education/education.module';
import { HealthModule } from './health/health.module';
import { IndexerModule } from './indexer/indexer.module';
import { IpfsModule } from './ipfs/ipfs.module';
import { LoggingModule } from './logging/logging.module';
import { PrismaModule } from './prisma/prisma.module';
import { TransactionsModule } from './transactions/transactions.module';

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
 * - {@link ChainReadModule}: read-through cache with provenance for financial values (Req 1.4, 1.5).
 * - {@link HttpExceptionFilter}: registered globally so every error returns a
 *   consistent, correlatable, secret-free envelope.
 * - {@link EducationModule}: course content, lesson tracking, certificate orchestration (Req 8).
 * - {@link IndexerModule}: event indexer worker for caching blockchain events (Req 12, 13).
 * - {@link IpfsModule}: profile document and certificate metadata storage (Req 3.5, 8.4).
 * - {@link TransactionsModule}: paginated transaction history from cached events (Req 12.3, 12.4).
 * - {@link AnalyticsModule}: provenanced portfolio analytics and metrics (Req 11.1).
 *
 * Additional feature modules (indexer, AI, etc.) are added in later tasks and
 * inherit the global guards registered by {@link AuthModule}.
 */
@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    PrismaModule,
    AuthModule,
    HealthModule,
    ChainReadModule,
    IndexerModule,
    IpfsModule,
    EducationModule,
    TransactionsModule,
    AnalyticsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
