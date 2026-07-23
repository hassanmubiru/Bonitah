import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

/**
 * Analytics module for portfolio and financial metrics (Requirement 11.1).
 * 
 * Provides provenanced analytics endpoints derived from cached blockchain events.
 */
@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}