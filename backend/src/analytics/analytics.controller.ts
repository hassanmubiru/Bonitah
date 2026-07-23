import { Controller, Get, Request } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PortfolioSeriesResponse } from '@bfn/shared';
import { AuthenticatedRequest } from '../auth/auth.types';

/**
 * Analytics endpoints for portfolio and financial metrics (Requirement 11.1).
 * 
 * Provides provenanced analytics data for authenticated users.
 */
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Get portfolio value series for the authenticated user.
   * 
   * Returns time-series data showing the user's portfolio growth over time,
   * derived from cached blockchain events with full provenance.
   * 
   * @param req - Authenticated request containing user's wallet address
   * @returns Portfolio value series with provenance metadata
   */
  @Get('portfolio')
  async getPortfolioSeries(@Request() req: AuthenticatedRequest): Promise<PortfolioSeriesResponse> {
    return this.analyticsService.getPortfolioSeries(req.user.address);
  }
}