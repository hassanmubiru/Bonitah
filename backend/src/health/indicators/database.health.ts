import { Injectable } from '@nestjs/common';
import { HealthIndicator, type HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';

import { EnvService } from '../../config/env.service';
import { hostPortFromUrl, tcpProbe } from './tcp.util';

/**
 * Readiness indicator for the PostgreSQL database.
 *
 * The full Prisma client is introduced in a later task (Prisma schema/migrations).
 * Until then this performs a real transport-level reachability probe against the
 * database host/port derived from `DATABASE_URL`, which is sufficient for
 * container/compose readiness gating (Req 16.2). When the Prisma client lands,
 * this check should be upgraded to a `SELECT 1` round-trip.
 */
@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  private static readonly DEFAULT_PG_PORT = 5432;
  private static readonly KEY = 'database';

  constructor(private readonly env: EnvService) {
    super();
  }

  async isHealthy(): Promise<HealthIndicatorResult> {
    const target = hostPortFromUrl(this.env.databaseUrl, DatabaseHealthIndicator.DEFAULT_PG_PORT);

    if (!target) {
      throw new HealthCheckError(
        'Database URL is not parseable',
        this.getStatus(DatabaseHealthIndicator.KEY, false, { reason: 'invalid DATABASE_URL' }),
      );
    }

    const reachable = await tcpProbe(target.host, target.port);
    const result = this.getStatus(DatabaseHealthIndicator.KEY, reachable, {
      host: target.host,
      port: target.port,
    });

    if (!reachable) {
      throw new HealthCheckError('Database is unreachable', result);
    }
    return result;
  }
}
