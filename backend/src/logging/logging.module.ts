import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { ConfigModule } from '../config/config.module';
import { EnvService } from '../config/env.service';
import { PINO_REDACT_PATHS, REDACTION_PLACEHOLDER } from './redaction';

/** Header used to propagate a correlation/request id across services. */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Structured logging module.
 *
 * Produces newline-delimited JSON logs (Req 16.7). Every HTTP request is
 * assigned a request id (honoring an inbound `x-request-id` header when
 * present, otherwise generating a UUID) so log lines are correlatable. Custom
 * serializers use a strict whitelist so request/response headers, cookies, and
 * bodies are never emitted, and pino `redact` provides a defense-in-depth
 * backstop. No secrets or PII are logged.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        pinoHttp: {
          level: env.logLevel,
          // Correlation id: reuse inbound header when valid, else generate one.
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const existing = req.headers[REQUEST_ID_HEADER];
            const id =
              typeof existing === 'string' && existing.length > 0
                ? existing
                : randomUUID();
            res.setHeader(REQUEST_ID_HEADER, id);
            return id;
          },
          // Whitelist serializers: only safe, non-sensitive fields are logged.
          serializers: {
            req: (req: { id: string; method: string; url: string }) => ({
              id: req.id,
              method: req.method,
              url: req.url,
            }),
            res: (res: { statusCode: number }) => ({
              statusCode: res.statusCode,
            }),
          },
          redact: {
            paths: [...PINO_REDACT_PATHS],
            censor: REDACTION_PLACEHOLDER,
          },
          // Human-readable output in development; raw JSON everywhere else so
          // production log pipelines ingest structured data.
          transport:
            env.isProduction || env.nodeEnv === 'test'
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    colorize: true,
                    translateTime: 'SYS:standard',
                  },
                },
        },
      }),
    }),
  ],
})
export class LoggingModule {}
