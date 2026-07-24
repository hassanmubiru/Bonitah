import { Controller, Post, Get, Body, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AiService } from './ai.service';
import {
  chatRequestSchema,
  type ChatRequestDto,
  type ChatResponseDto,
  type ConversationsResponseDto,
  type ConversationResponseDto,
} from './ai.schemas';
import type { AuthenticatedRequest } from '../auth/auth.types';

/**
 * AI Assistant controller for BFN financial guidance endpoints.
 *
 * Provides REST endpoints for:
 * - POST /ai/chat - Submit question and get AI response (Req 10.1, 10.7, 10.8)
 * - GET /ai/conversations - Get conversation history (Req 10.4)
 * - GET /ai/conversations/:id - Get specific conversation details
 *
 * All endpoints require JWT authentication and USER role minimum.
 * Integrates with ChainRead for on-chain data and enforces all AI assistant constraints.
 */
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER) // Minimum role required for AI assistant access
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * Submit a question to the AI assistant and get financial guidance.
   *
   * POST /ai/chat
   *
   * Validates question length (≤2000 chars), integrates with on-chain data,
   * enforces 30s timeout, and persists conversation history.
   *
   * @param request - Authenticated request with user info
   * @param body - Chat request with user question
   * @returns AI assistant response with conversation ID
   * @throws BadRequestException if question exceeds 2000 characters (Req 10.7)
   * @throws ServiceUnavailableException if AI unavailable or timeout (Req 10.8)
   */
  @Post('chat')
  async chat(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(chatRequestSchema)) body: ChatRequestDto,
  ): Promise<ChatResponseDto> {
    const { userId, walletAddress } = request.user;

    const result = await this.aiService.chat(userId, walletAddress, body.question);

    return {
      answer: result.answer,
      conversationId: result.conversationId,
    };
  }

  /**
   * Get user's conversation history.
   *
   * GET /ai/conversations
   *
   * Returns paginated list of conversations with preview of recent messages.
   *
   * @param request - Authenticated request with user info
   * @param limit - Maximum number of conversations to return (optional, default 10)
   * @returns Array of conversation summaries
   */
  @Get('conversations')
  async getConversations(
    @Req() request: AuthenticatedRequest,
    @Query('limit') limit?: string,
  ): Promise<ConversationsResponseDto> {
    const { userId } = request.user;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    // Validate limit
    const validLimit = Math.min(Math.max(limitNum, 1), 50); // Between 1 and 50

    const conversations = await this.aiService.getConversations(userId, validLimit);

    return { conversations };
  }

  /**
   * Get specific conversation details with full message history.
   *
   * GET /ai/conversations/:id
   *
   * @param request - Authenticated request with user info  
   * @param conversationId - Conversation ID from query params
   * @returns Full conversation details or 404 if not found/unauthorized
   */
  @Get('conversation')
  async getConversation(
    @Req() request: AuthenticatedRequest,
    @Query('id') conversationId: string,
  ): Promise<ConversationResponseDto> {
    const { userId } = request.user;

    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    const conversation = await this.aiService.getConversation(userId, conversationId);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    return { conversation };
  }
}
