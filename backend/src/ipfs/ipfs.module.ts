import { Module } from '@nestjs/common';
import { IpfsService } from './ipfs.service';
import { IpfsController } from './ipfs.controller';

/**
 * IPFS module for BFN profile documents and certificate metadata.
 *
 * Provides upload, pinning, and retrieval services with size/count limits
 * and PII exclusion (Req 3.5, 3.8, 3.9, 8.4). Uses Pinata as the pinning
 * service provider configured via environment variables.
 */
@Module({
  providers: [IpfsService],
  controllers: [IpfsController],
  exports: [IpfsService],
})
export class IpfsModule {}