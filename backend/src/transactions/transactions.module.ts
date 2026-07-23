import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Transactions module provides paginated transaction history
 * from cached blockchain events (Req 12.3, 12.4).
 *
 * Returns cached events scoped to the requesting user's wallet address,
 * ordered by descending block number, and properly paginated with at most
 * 100 events per response.
 */
@Module({
  imports: [PrismaModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}