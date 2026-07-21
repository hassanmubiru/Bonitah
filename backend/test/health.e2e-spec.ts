import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { REQUEST_ID_HEADER } from '../src/logging/logging.constants';

/**
 * Boots the full application graph and exercises the liveness endpoint. This
 * verifies that config validation, structured logging, the global exception
 * filter, and the health module all wire together and the process serves HTTP.
 *
 * Liveness intentionally has no external dependency checks, so this test does
 * not require a live database/Redis/RPC.
 */
describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      PORT: '3999',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgresql://bfn:bfn@localhost:5432/bfn?schema=public',
      REDIS_URL: 'redis://localhost:6379',
      BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
      CHAIN_ID: '84532',
      JWT_SECRET: 'x'.repeat(32),
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health/live returns 200 ok with a request id header', async () => {
    const res = await request(app.getHttpServer()).get('/health/live').expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.headers[REQUEST_ID_HEADER]).toBeDefined();
  });

  it('propagates an inbound request id', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/live')
      .set(REQUEST_ID_HEADER, 'trace-abc')
      .expect(200);

    expect(res.headers[REQUEST_ID_HEADER]).toBe('trace-abc');
  });

  it('GET /unknown returns the structured error envelope with a request id', async () => {
    const res = await request(app.getHttpServer()).get('/does-not-exist').expect(404);

    expect(res.body.statusCode).toBe(404);
    expect(res.body.requestId).toBeDefined();
    expect(res.body.path).toBe('/does-not-exist');
    expect(res.body.timestamp).toBeDefined();
  });
});
