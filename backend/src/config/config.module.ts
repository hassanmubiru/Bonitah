import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { validateEnv } from './env.schema';
import { EnvService } from './env.service';

/**
 * Global configuration module.
 *
 * Loads environment variables (from the process environment and an optional
 * `.env` file), validates them once at startup via {@link validateEnv}, and
 * exposes the typed {@link EnvService} everywhere. Declaring it {@link Global}
 * means feature modules can inject {@link EnvService} without re-importing.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Zod performs all validation; a thrown error here aborts startup.
      validate: (raw) => validateEnv(raw),
      // Allow a local .env in non-container environments; container configs
      // inject real environment variables directly.
      envFilePath: ['.env'],
      ignoreEnvFile: process.env['NODE_ENV'] === 'production',
    }),
  ],
  providers: [EnvService],
  exports: [EnvService],
})
export class ConfigModule {}
