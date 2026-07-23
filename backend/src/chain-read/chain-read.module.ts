import { Module } from '@nestjs/common';

import { ChainReadService } from './chain-read.service';
import { ChainReadController } from './chain-read.controller';
import { RedisService } from './redis.service';
import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * ChainRead module providing read-through cache with provenance (Req 1.4, 1.5).
 * 
 * Reads financial values from Base Sepolia via viem, caches them with full
 * provenance metadata ({contractAddress, blockNumber, fetchedAt}), and enforces
 * 30-second staleness. Never serves stale or placeholder values on read failure.
 */
@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [ChainReadController],
  providers: [ChainReadService, RedisService],
  exports: [ChainReadService],
})
export class ChainReadModule {}