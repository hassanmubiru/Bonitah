import {
  BadRequestException,
  type ArgumentsHost,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';

import { HttpExceptionFilter, type ErrorResponseBody } from './http-exception.filter';

interface MockResponse {
  status: jest.Mock;
  json: jest.Mock;
  getHeader: jest.Mock;
  body?: ErrorResponseBody;
}

function createHost(): { host: ArgumentsHost; response: MockResponse } {
  const response: MockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(function (this: MockResponse, payload: ErrorResponseBody) {
      this.body = payload;
      return this;
    }),
    getHeader: jest.fn().mockReturnValue(undefined),
  };
  const request = { id: 'req-123', url: '/resource', method: 'GET' };

  const host = {
    switchToHttp: () => ({
      getResponse: <T>() => response as unknown as T,
      getRequest: <T>() => request as unknown as T,
    }),
  } as ArgumentsHost;

  return { host, response };
}

function createFilter(): HttpExceptionFilter {
  const logger = {
    setContext: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  } as unknown as PinoLogger;
  return new HttpExceptionFilter(logger);
}

describe('HttpExceptionFilter', () => {
  it('maps an HttpException to its status and message with the request id', () => {
    const filter = createFilter();
    const { host, response } = createHost();

    filter.catch(new NotFoundException('missing'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.body?.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(response.body?.requestId).toBe('req-123');
    expect(response.body?.path).toBe('/resource');
  });

  it('preserves validation message arrays (Req 14.4)', () => {
    const filter = createFilter();
    const { host, response } = createHost();

    filter.catch(new BadRequestException(['field is required', 'field must be a string']), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.body?.message).toEqual(['field is required', 'field must be a string']);
  });

  it('returns a generic 500 without leaking internal error details', () => {
    const filter = createFilter();
    const { host, response } = createHost();

    filter.catch(new Error('database password=secret leaked'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.body?.message).toBe('An unexpected error occurred');
    expect(JSON.stringify(response.body)).not.toContain('secret');
  });

  it('handles HttpException with a string response body', () => {
    const filter = createFilter();
    const { host, response } = createHost();

    filter.catch(new HttpException('teapot', HttpStatus.I_AM_A_TEAPOT), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.I_AM_A_TEAPOT);
    expect(response.body?.message).toBe('teapot');
  });
});
