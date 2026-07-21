import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { ConfigModule } from '../config/config.module';
import { EnvService } from '../config/env.service';
import { REQUEST_ID_HEADER } from './logging.constants';
import { PINO_REDACT_PATHS, REDACTION_PLACEHOLDER } from './redaction';

export { REQUEST_ID_HEADER } from './logging.constants';

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
      useFactory: (env: EnvService) => {
        // Human-readable output in development; raw JSON everywhere else so
        // production log pipelines ingest structured data. The `transport` key
        // is omitted entirely (not set to `undefined`) to satisfy strict
        // `exactOptionalPropertyTypes`.
        const prettyTransport =
          env.isProduction || env.nodeEnv === 'test'
            ? {}
            : {
                transport: {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    colorize: true,
                    translateTime: 'SYS:standard',
                  },
                },
              };

        return {
          pinoHttp: {
            level: env.logLevel,
            // Correlation id: reuse inbound header when valid, else generate one.
            genReqId: (req: IncomingMessage, res: ServerResponse): string => {
              const existing = req.headers[REQUEST_ID_HEADER];
              const id =
                typeof existing === 'string' && existing.length > 0 ? existing : randomUUID();
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
            ...prettyTransport,
          },
        };
      },
    }),
  ],
})
export class LoggingModule {}
