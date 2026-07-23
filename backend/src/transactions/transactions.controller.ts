import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TransactionsService } from './transactions.service';
import { TransactionsQuery, TransactionsResponse } from '@bfn/shared';
import { AuthenticatedRequest } from '../auth/auth.types';

/**
 * Transactions controller provides paginated transaction history
 * for authenticated users (Req 12.3, 12.4).
 *
 * Returns cached blockchain events scoped to the requesting user's
 * wallet address, ordered by descending block number, with cursor-based
 * pagination and at most 100 events per response.
 */
@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * Get paginated transaction history for the authenticated user.
   *
   * Returns cached events scoped to the user's wallet address,
   * ordered by descending block number, with cursor-based pagination.
   *
   * @param query Pagination parameters (cursor and limit)
   * @param request Authenticated request with user info
   * @returns Paginated transaction history
   */
  @Get()
  async getTransactionHistory(
    @Query() query: TransactionsQuery,
    @Request() request: AuthenticatedRequest,
  ): Promise<TransactionsResponse> {
    const walletAddress = request.user.address;
    return this.transactionsService.getTransactionHistory(walletAddress, query);
  }
}