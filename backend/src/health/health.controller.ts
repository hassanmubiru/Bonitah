import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, type HealthCheckResult } from '@nestjs/terminus';

import { Public } from '../auth/decorators/public.decorator';
import { DatabaseHealthIndicator } from './indicators/database.health';
// import { RedisHealthIndicator } from './indicators/redis.health'; // Temporarily disabled - Redis not installed
import { RpcHealthIndicator } from './indicators/rpc.health';

/**
 * Health endpoints consumed by container orchestration and Docker Compose
 * healthchecks (Req 16.2).
 *
 * - `GET /health/live`  liveness: the process is up and able to serve HTTP.
 * - `GET /health/ready` readiness: dependencies (DB, Redis, Base Sepolia RPC)
 *   are reachable, so the instance can serve real traffic.
 * - `GET /health`       alias for readiness.
 *
 * These routes are public (no authentication) so probes can reach them: the
 * controller is marked `@Public()` to opt out of the global {@link JwtAuthGuard}
 * (Req 14.1).
 */
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
    // private readonly redis: RedisHealthIndicator, // Temporarily disabled - Redis not installed
    private readonly rpc: RpcHealthIndicator,
  ) {}

  @Get('live')
  @HealthCheck()
  liveness(): Promise<HealthCheckResult> {
    // Liveness only asserts the process itself is healthy; it must not depend
    // on external services so a transient dependency outage does not trigger a
    // restart loop.
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.database.isHealthy(),
      // () => this.redis.isHealthy(), // Temporarily disabled - Redis not installed
      () => this.rpc.isHealthy(),
    ]);
  }

  @Get()
  @HealthCheck()
  root(): Promise<HealthCheckResult> {
    return this.readiness();
  }
}
