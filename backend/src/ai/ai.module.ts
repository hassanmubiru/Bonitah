import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ChainReadModule } from '../chain-read/chain-read.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '../config/config.module';

/**
 * AI Assistant module for BFN financial guidance.
 *
 * Provides OpenAI-powered financial assistance with strict constraints:
 * - Question length validation (≤2000 chars, Req 10.7)  
 * - 30-second timeout enforcement (Req 10.8)
 * - On-chain data integration (read-only access, Req 10.3)
 * - Conversation history persistence (Req 10.4)
 * - Explicit "never sign transactions" instruction (Req 10.2)
 * - Scoped to budgeting/savings/investment education only (Req 10.1)
 *
 * Dependencies:
 * - {@link ChainReadModule}: For reading user financial data from Base Sepolia (Req 10.3)
 * - {@link PrismaModule}: For conversation history storage (Req 10.4)  
 * - {@link ConfigModule}: For OpenAI API key configuration
 *
 * Endpoints:
 * - POST /ai/chat: Submit question and get AI response
 * - GET /ai/conversations: Get conversation history list
 * - GET /ai/conversation?id=X: Get specific conversation details
 */
@Module({
  imports: [ChainReadModule, PrismaModule, ConfigModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService], // Export for potential use by other modules
})
export class AiModule {}
