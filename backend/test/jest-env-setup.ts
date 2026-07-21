/**
 * Runs before any test module is imported (Jest `setupFiles`). It seeds a
 * valid test environment so modules that validate configuration at import time
 * (e.g. the config module) can load. Individual unit tests that exercise
 * validation call `validateEnv` directly with their own inputs and are not
 * affected by these defaults.
 */
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = process.env['PORT'] ?? '3999';
process.env['LOG_LEVEL'] = 'silent';
process.env['DATABASE_URL'] =
  process.env['DATABASE_URL'] ?? 'postgresql://bfn:bfn@localhost:5432/bfn?schema=public';
process.env['REDIS_URL'] = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
process.env['BASE_SEPOLIA_RPC_URL'] =
  process.env['BASE_SEPOLIA_RPC_URL'] ?? 'https://sepolia.base.org';
process.env['CHAIN_ID'] = process.env['CHAIN_ID'] ?? '84532';
process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'x'.repeat(32);
