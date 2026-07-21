import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Global database access module.
 *
 * Exposes a single, connection-managed {@link PrismaService} across the app so
 * feature modules can inject it without re-importing. Declared {@link Global}
 * because nearly every off-chain feature module (users, education, indexer,
 * chain-read cache, AI history, notifications) depends on database access.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
