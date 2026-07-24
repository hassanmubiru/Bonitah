import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from './env.schema';

/**
 * Type-safe accessor over the validated environment.
 *
 * Wraps Nest's {@link ConfigService} so the rest of the app reads configuration
 * through strongly-typed getters instead of untyped `process.env` access.
 * Because {@link validateEnv} has already run, every value here is guaranteed
 * present and well-formed.
 */
@Injectable()
export class EnvService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get nodeEnv(): Env['NODE_ENV'] {
    return this.get('NODE_ENV');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get port(): number {
    return this.get('PORT');
  }

  get logLevel(): Env['LOG_LEVEL'] {
    return this.get('LOG_LEVEL');
  }

  get corsOrigins(): string[] {
    return this.get('CORS_ORIGINS')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  get databaseUrl(): string {
    return this.get('DATABASE_URL');
  }

  get redisUrl(): string {
    return this.get('REDIS_URL');
  }

  get baseSepoliaRpcUrl(): string {
    return this.get('BASE_SEPOLIA_RPC_URL');
  }

  get baseSepolia(): string {
    return this.get('BASE_SEPOLIA_RPC_URL');
  }

  get chainId(): number {
    return this.get('CHAIN_ID');
  }

  /** HMAC secret used to sign and verify session JWTs (Req 2.7, 14.1). */
  get jwtSecret(): string {
    return this.get('JWT_SECRET');
  }

  /** Configured session lifetime string (e.g. `24h`); parsed by the auth module. */
  get jwtExpiresIn(): string {
    return this.get('JWT_EXPIRES_IN');
  }

  /** OpenAI API key for the AI assistant service (optional at boot, validated on use). */
  get openaiApiKey(): string | undefined {
    return this.get('OPENAI_API_KEY');
  }
}
