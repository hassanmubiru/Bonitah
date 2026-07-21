import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { EnvService } from './config/env.service';
import { REQUEST_ID_HEADER } from './logging/logging.constants';

/**
 * Application entrypoint.
 *
 * Boots the Nest app with the structured logger as the framework logger,
 * enables graceful shutdown hooks, configures CORS from validated config, and
 * applies a strict global validation pipe. The global exception filter is
 * registered in {@link AppModule}.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // Route all framework logs through the structured pino logger.
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const env = app.get(EnvService);

  app.enableCors({
    origin: env.corsOrigins,
    credentials: true,
    exposedHeaders: [REQUEST_ID_HEADER],
  });

  // Baseline global validation. Feature DTOs and the zod validation pipe are
  // layered in the dedicated validation/auth task.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.BAD_REQUEST,
    }),
  );

  await app.listen(env.port);

  app.get(Logger).log(`BFN backend listening on port ${env.port}`, 'Bootstrap');
}

void bootstrap();
