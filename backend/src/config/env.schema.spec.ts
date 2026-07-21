import { BASE_SEPOLIA_CHAIN_ID, validateEnv } from './env.schema';

const validRaw = (): Record<string, unknown> => ({
  NODE_ENV: 'test',
  PORT: '3001',
  LOG_LEVEL: 'info',
  CORS_ORIGINS: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://bfn:bfn@localhost:5432/bfn?schema=public',
  REDIS_URL: 'redis://localhost:6379',
  BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
  CHAIN_ID: '84532',
  JWT_SECRET: 'a'.repeat(32),
  JWT_EXPIRES_IN: '24h',
});

describe('validateEnv', () => {
  it('accepts a valid environment and coerces numeric fields', () => {
    const env = validateEnv(validRaw());

    expect(env.PORT).toBe(3001);
    expect(env.CHAIN_ID).toBe(BASE_SEPOLIA_CHAIN_ID);
    expect(env.NODE_ENV).toBe('test');
  });

  it('applies defaults for optional fields', () => {
    const raw = validRaw();
    delete raw['PORT'];
    delete raw['LOG_LEVEL'];
    delete raw['CHAIN_ID'];

    const env = validateEnv(raw);

    expect(env.PORT).toBe(3001);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.CHAIN_ID).toBe(BASE_SEPOLIA_CHAIN_ID);
  });

  it('rejects a missing required variable', () => {
    const raw = validRaw();
    delete raw['DATABASE_URL'];

    expect(() => validateEnv(raw)).toThrow(/DATABASE_URL/);
  });

  it('rejects a JWT secret shorter than 32 characters', () => {
    const raw = validRaw();
    raw['JWT_SECRET'] = 'too-short';

    expect(() => validateEnv(raw)).toThrow(/JWT_SECRET/);
  });

  it('rejects a chain id that is not Base Sepolia', () => {
    const raw = validRaw();
    raw['CHAIN_ID'] = '1';

    expect(() => validateEnv(raw)).toThrow(/Base Sepolia/);
  });

  it('does not leak the offending secret value in the error message', () => {
    const raw = validRaw();
    const secret = 'sample-secret-under-32-chars';
    raw['JWT_SECRET'] = secret;

    expect(() => validateEnv(raw)).toThrow();
    try {
      validateEnv(raw);
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
    }
  });
});
