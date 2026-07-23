import { Module } from '@nestjs/common';
import { EducationService } from './education.service';
import { EducationController } from './education.controller';
import { IpfsModule } from '../ipfs/ipfs.module';

/**
 * Education module for BFN courses, lessons, progress, and certificates.
 *
 * Provides off-chain course content management, lesson completion tracking,
 * learning streaks, and certificate orchestration with IPFS storage and
 * on-chain issuance (Req 8.1, 8.2, 8.3, 8.4, 8.6, 8.8, 8.9).
 */
@Module({
  imports: [IpfsModule],
  providers: [EducationService],
  controllers: [EducationController],
  exports: [EducationService],
})
export class EducationModule {}