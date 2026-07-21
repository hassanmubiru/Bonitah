import { Injectable } from '@nestjs/common';
import { HealthIndicator, type HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';

import { EnvService } from '../../config/env.service';
import { hostPortFromUrl, tcpProbe } from './tcp.util';

/**
 * Readiness indicator for Redis.
 *
 * The full Redis client is introduced with the read-through cache/indexer
 * tasks. Until then this performs a real transport-level reachability probe
 * against the host/port derived from `REDIS_URL`, sufficient for compose
 * readiness gating (Req 16.2). When the Redis client lands, upgrade this to a
 * `PING`/`PONG` round-trip.
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private static readonly DEFAULT_REDIS_PORT = 6379;
  private static readonly KEY = 'redis';

  constructor(private readonly env: EnvService) {
    super();
  }

  async isHealthy(): Promise<HealthIndicatorResult> {
    const target = hostPortFromUrl(this.env.redisUrl, RedisHealthIndicator.DEFAULT_REDIS_PORT);

    if (!target) {
      throw new HealthCheckError(
        'Redis URL is not parseable',
        this.getStatus(RedisHealthIndicator.KEY, false, { reason: 'invalid REDIS_URL' }),
      );
    }

    const reachable = await tcpProbe(target.host, target.port);
    const result = this.getStatus(RedisHealthIndicator.KEY, reachable, {
      host: target.host,
      port: target.port,
    });

    if (!reachable) {
      throw new HealthCheckError('Redis is unreachable', result);
    }
    return result;
  }
}
