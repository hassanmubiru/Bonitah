import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from './health.controller';
import { DatabaseHealthIndicator } from './indicators/database.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { RpcHealthIndicator } from './indicators/rpc.health';

/**
 * Health module wiring Terminus with the BFN dependency indicators
 * (PostgreSQL, Redis, Base Sepolia RPC). Exposes liveness/readiness endpoints
 * for compose and orchestration healthchecks (Req 16.2).
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [DatabaseHealthIndicator, RedisHealthIndicator, RpcHealthIndicator],
})
export class HealthModule {}
