import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OpenAI } from 'openai';
import { EnvService } from '../config/env.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChainReadService } from '../chain-read/chain-read.service';
import type { ContractName } from '@bfn/shared';

/**
 * AI Assistant service for BFN financial guidance.
 *
 * Provides AI-powered financial assistance with strict constraints:
 * - Question length validation (≤2000 chars, Req 10.7)
 * - 30-second timeout enforcement (Req 10.8)
 * - On-chain data integration (read-only access, Req 10.3)
 * - Conversation history persistence (Req 10.4)
 * - Explicit "never sign transactions" instruction (Req 10.2)
 * - Error handling for service unavailability (Req 10.8, 10.9)
 * - Scoped to budgeting/savings/investment education only (Req 10.1)
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI | null = null;

  constructor(
    private readonly env: EnvService,
    private readonly prisma: PrismaService,
    private readonly chainRead: ChainReadService,
  ) {
    // Initialize OpenAI client only if API key is provided
    if (this.env.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: this.env.openaiApiKey,
      });
    }
  }

  /**
   * Process a user question and return AI-generated financial guidance.
   *
   * Validates question length, reads user's on-chain financial data,
   * calls OpenAI with scoped prompt, enforces timeout, and persists history.
   *
   * @param userId - User ID from JWT authentication
   * @param walletAddress - User's wallet address from JWT
   * @param question - User's question (≤2000 characters)
   * @returns AI assistant response
   * @throws BadRequestException if question exceeds 2000 characters (Req 10.7)
   * @throws ServiceUnavailableException if AI service unavailable or timeout (Req 10.8)
   */
  async chat(
    userId: string,
    address: string,
    question: string,
  ): Promise<{ answer: string; conversationId: string }> {
    // Validate question length (Req 10.7)
    if (question.length > 2000) {
      throw new BadRequestException(
        `Question exceeds maximum allowed length of 2000 characters (current: ${question.length})`,
      );
    }

    // Check if OpenAI is configured
    if (!this.openai) {
      throw new ServiceUnavailableException(
        'AI assistant is temporarily unavailable - service not configured',
      );
    }

    // Get or create conversation
    const conversation = await this.getOrCreateConversation(userId);

    try {
      // Get user's financial data from on-chain sources (Req 10.3)
      const financialContext = await this.getUserFinancialContext(address);

      // Build the system prompt with strict scoping and transaction prohibition (Req 10.1, 10.2)
      const systemPrompt = this.buildSystemPrompt(financialContext, address);

      // Get recent conversation history for context (last 10 messages)
      const recentMessages = await this.getRecentConversationHistory(conversation.id, 10);

      // Build messages array for OpenAI
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...recentMessages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        { role: 'user', content: question },
      ];

      // Call OpenAI with 30-second timeout (Req 10.8)
      const response = await this.callOpenAIWithTimeout(messages, 30000);

      // Store the conversation turn (Req 10.4)
      await this.storeConversationTurn(conversation.id, question, response);

      this.logger.log(
        `AI chat completed: user=${userId}, question_length=${question.length}, response_length=${response.length}`,
      );

      return {
        answer: response,
        conversationId: conversation.id,
      };
    } catch (error) {
      // Log error but preserve conversation history (Req 10.8)
      this.logger.error(`AI chat failed for user ${userId}`, error);

      if (error instanceof BadRequestException) {
        throw error; // Re-throw validation errors
      }

      // For all other errors, return service unavailable
      throw new ServiceUnavailableException(
        'AI assistant is temporarily unavailable. Please try again later.',
      );
    }
  }

  /**
   * Get conversation history for a user.
   *
   * @param userId - User ID
   * @param limit - Maximum number of conversations to return
   * @returns Array of conversations with recent messages
   */
  async getConversations(userId: string, limit = 10) {
    const conversations = await this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 3, // Last 3 messages for preview
        },
      },
    });

    return conversations.map((conv) => ({
      id: conv.id,
      createdAt: conv.createdAt,
      messageCount: conv.messages.length,
      lastMessage: conv.messages[0]?.content || null,
      lastMessageAt: conv.messages[0]?.createdAt || conv.createdAt,
    }));
  }

  /**
   * Get full conversation history by conversation ID.
   *
   * @param userId - User ID (for authorization)
   * @param conversationId - Conversation ID
   * @returns Full conversation with all messages
   */
  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId, // Ensure user owns this conversation
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      return null;
    }

    return {
      id: conversation.id,
      createdAt: conversation.createdAt,
      messages: conversation.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
      })),
    };
  }

  /**
   * Get or create a conversation for the user.
   */
  private async getOrCreateConversation(userId: string) {
    // Look for the most recent conversation
    let conversation = await this.prisma.conversation.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!conversation) {
      // Create new conversation
      conversation = await this.prisma.conversation.create({
        data: { userId },
      });

      this.logger.debug(`Created new conversation ${conversation.id} for user ${userId}`);
    }

    return conversation;
  }

  /**
   * Get user's financial context from on-chain data (Req 10.3).
   * On read failure, marks figures as unavailable and never fabricates (Req 10.9).
   */
  private async getUserFinancialContext(address: string): Promise<string> {
    const context: string[] = [];

    try {
      // Try to read savings balance from SavingsVault
      const savingsResult = await this.chainRead.read({
        contract: 'SavingsVault' as ContractName,
        functionName: 'availableBalance',
        args: [address],
      });

      context.push(
        `Available savings balance: ${savingsResult.value} tokens (as of block ${savingsResult.provenance.blockNumber})`,
      );
    } catch (error) {
      // On read failure, mark as unavailable (Req 10.9)
      context.push('Available savings balance: unavailable (unable to read from blockchain)');
      this.logger.warn(`Failed to read savings balance for ${address}`, error);
    }

    try {
      // Try to read portfolio value
      const portfolioResult = await this.chainRead.read({
        contract: 'SavingsVault' as ContractName,
        functionName: 'portfolioValue',
        args: [address],
      });

      context.push(
        `Total portfolio value: ${portfolioResult.value} tokens (as of block ${portfolioResult.provenance.blockNumber})`,
      );
    } catch (error) {
      // On read failure, mark as unavailable (Req 10.9)
      context.push('Total portfolio value: unavailable (unable to read from blockchain)');
      this.logger.warn(`Failed to read portfolio value for ${address}`, error);
    }

    try {
      // Try to read user profile for reputation
      const profileResult = await this.chainRead.read({
        contract: 'Registry' as ContractName,
        functionName: 'getProfile',
        args: [address],
      });

      context.push(
        `User reputation score: ${profileResult.value} (as of block ${profileResult.provenance.blockNumber})`,
      );
    } catch (error) {
      // On read failure, mark as unavailable (Req 10.9)
      context.push('User reputation score: unavailable (unable to read from blockchain)');
      this.logger.warn(`Failed to read user profile for ${walletAddress}`, error);
    }

    return context.length > 0 ? context.join('\n') : 'No financial data available at this time.';
  }

  /**
   * Build the system prompt with strict scope and transaction prohibition (Req 10.1, 10.2).
   */
  private buildSystemPrompt(financialContext: string, walletAddress: string): string {
    return `You are a financial assistant for Bonitah Financial Network (BFN), helping users with personal finance education and guidance.

CRITICAL CONSTRAINTS:
- You MUST NEVER initiate, sign, or submit blockchain transactions
- You MUST NEVER provide specific investment advice or recommendations for particular assets
- You MUST NEVER ask for or handle private keys, seed phrases, or sensitive credentials
- Your responses MUST be limited to: budgeting guidance, savings planning, investment education (general principles), goal recommendations, transaction explanation, and portfolio insights

SCOPE OF ASSISTANCE:
- Budgeting and expense management education
- Savings strategies and goal-setting guidance
- General investment education and principles
- Explanation of DeFi concepts and blockchain transactions
- Portfolio diversification principles
- Risk management education
- Financial planning methodologies

USER CONTEXT:
Wallet Address: ${walletAddress}
Current Financial Data:
${financialContext}

RESPONSE GUIDELINES:
- Keep responses educational and general, not specific investment advice
- If the user asks you to perform transactions, explain that they must use the BFN interface to sign transactions themselves
- Focus on helping them understand their options and the principles behind financial decisions
- Use their current financial data for context, but clearly indicate when data is unavailable
- Be concise but helpful, aiming for 1-3 paragraphs unless more detail is specifically requested

Remember: You are an educational assistant, not a transaction executor or investment advisor.`;
  }

  /**
   * Get recent conversation history for context.
   */
  private async getRecentConversationHistory(conversationId: string, limit: number) {
    return this.prisma.message
      .findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: limit * 2, // Get more to account for user/assistant pairs
      })
      .then((messages) => messages.reverse()); // Reverse to chronological order
  }

  /**
   * Call OpenAI with timeout enforcement (Req 10.8).
   */
  private async callOpenAIWithTimeout(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    timeoutMs: number,
  ): Promise<string> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('OpenAI request timeout'));
      }, timeoutMs);
    });

    const openaiPromise = this.openai!.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: 500, // Reasonable limit for financial guidance
      temperature: 0.7,
    });

    try {
      const result = await Promise.race([openaiPromise, timeoutPromise]);
      const content = result.choices[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      return content;
    } catch (error) {
      if (error instanceof Error && error.message === 'OpenAI request timeout') {
        throw new ServiceUnavailableException('AI assistant request timed out. Please try again.');
      }
      throw error;
    }
  }

  /**
   * Store conversation turn in database (Req 10.4).
   */
  private async storeConversationTurn(
    conversationId: string,
    question: string,
    answer: string,
  ): Promise<void> {
    await this.prisma.$transaction([
      // Store user message
      this.prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: question,
        },
      }),
      // Store assistant response
      this.prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: answer,
        },
      }),
    ]);
  }
}
