import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

import { REQUEST_ID_HEADER } from '../../logging/logging.constants';
import { redactSensitive } from '../../logging/redaction';

/** Stable shape returned for every unhandled/handled error (Req 14.4). */
export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  requestId: string;
  timestamp: string;
  path: string;
}

/**
 * Global exception filter.
 *
 * Converts any thrown error into a consistent JSON error envelope that carries
 * the request id for correlation. It logs the failure through the structured
 * logger (with sensitive fields redacted) and, for unexpected (non-HTTP)
 * errors, returns a generic 500 message so internal details and secrets are
 * never leaked to clients.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(HttpExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, error, message } = this.resolve(exception);

    const requestId =
      (typeof request.id === 'string' && request.id) ||
      (response.getHeader(REQUEST_ID_HEADER) as string | undefined) ||
      'unknown';

    const body: ErrorResponseBody = {
      statusCode: status,
      error,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Log server-side faults at error level with a redacted context; client
    // faults (4xx) are logged at warn level.
    const logPayload = {
      statusCode: status,
      error,
      path: request.url,
      method: request.method,
      cause: redactSensitive(this.describe(exception)),
    };
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(logPayload, 'Request failed');
    } else {
      this.logger.warn(logPayload, 'Request rejected');
    }

    response.status(status).json(body);
  }

  private resolve(exception: unknown): {
    status: number;
    error: string;
    message: string | string[];
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        return { status, error: exception.name, message: res };
      }

      const record = res as Record<string, unknown>;
      const message = (record['message'] ?? exception.message) as string | string[];
      const error = (record['error'] as string | undefined) ?? exception.name;
      return { status, error, message };
    }

    // Unexpected error: never expose the underlying message to the client.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
    };
  }

  private describe(exception: unknown): unknown {
    if (exception instanceof Error) {
      return { name: exception.name, message: exception.message, stack: exception.stack };
    }
    return exception;
  }
}
