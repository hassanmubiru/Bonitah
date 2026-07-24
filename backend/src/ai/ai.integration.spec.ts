import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { EnvService } from '../config/env.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChainReadService } from '../chain-read/chain-read.service';

/**
 * Integration tests for AI Service focusing on core requirements validation.
 * 
 * Tests key requirements:
 * - Question length validation (Req 10.7)
 * - Service unavailability handling (Req 10.8) 
 * - On-chain data integration (Req 10.3, 10.9)
 * - System prompt constraints (Req 10.1, 10.2)
 */
describe('AiService Integration', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: EnvService,
          useValue: {
            openaiApiKey: undefined, // No OpenAI key for tests
          },
        },
        {
          provide: PrismaService,
          useValue: {
            conversation: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue({ id: 'test-conv', userId: 'test-user', createdAt: new Date() }),
              findMany: jest.fn().mockResolvedValue([]),
            },
            message: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            $transaction: jest.fn().mockResolvedValue([{}, {}]),
          },
        },
        {
          provide: ChainReadService,
          useValue: {
            read: jest.fn().mockRejectedValue(new Error('Test network error')),
            clearCache: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  describe('Question Length Validation (Req 10.7)', () => {
    it('should reject questions exceeding 2000 characters', async () => {
      const longQuestion = 'x'.repeat(2001);
      const userId = 'test-user';
      const address = '0x1234567890123456789012345678901234567890';

      await expect(service.chat(userId, address, longQuestion))
        .rejects.toThrow(BadRequestException);

      try {
        await service.chat(userId, address, longQuestion);
        fail('Should have thrown BadRequestException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('2000 characters');
        expect(error.message).toContain('2001');
      }
    });

    it('should accept questions with exactly 2000 characters', async () => {
      const maxLengthQuestion = 'x'.repeat(2000);
      const userId = 'test-user';
      const address = '0x1234567890123456789012345678901234567890';

      // Should not throw BadRequestException for length
      // Will throw ServiceUnavailableException due to no OpenAI config
      await expect(service.chat(userId, address, maxLengthQuestion))
        .rejects.toThrow(ServiceUnavailableException);
    });

    it('should accept shorter questions', async () => {
      const shortQuestion = 'What is my balance?';
      const userId = 'test-user';
      const address = '0x1234567890123456789012345678901234567890';

      // Should not throw BadRequestException for length
      await expect(service.chat(userId, address, shortQuestion))
        .rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('Service Unavailability (Req 10.8)', () => {
    it('should return appropriate error when OpenAI is not configured', async () => {
      const question = 'What is my balance?';
      const userId = 'test-user';
      const address = '0x1234567890123456789012345678901234567890';

      await expect(service.chat(userId, address, question))
        .rejects.toThrow(ServiceUnavailableException);

      try {
        await service.chat(userId, address, question);
        fail('Should have thrown ServiceUnavailableException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expect(error.message).toContain('temporarily unavailable');
        expect(error.message).toContain('not configured');
      }
    });
  });

  describe('System Prompt Generation (Req 10.1, 10.2)', () => {
    it('should generate system prompt with proper constraints and scope', () => {
      const financialContext = 'Test financial data';
      const address = '0x1234567890123456789012345678901234567890';

      // Access private method for testing
      const systemPrompt = (service as any).buildSystemPrompt(financialContext, address);

      // Transaction prohibition (Req 10.2)
      expect(systemPrompt).toContain('NEVER initiate, sign, or submit blockchain transactions');
      expect(systemPrompt).toContain('NEVER provide specific investment advice');
      expect(systemPrompt).toContain('NEVER ask for or handle private keys');

      // Scope limitations (Req 10.1)
      expect(systemPrompt).toContain('budgeting guidance');
      expect(systemPrompt).toContain('Savings strategies');
      expect(systemPrompt).toContain('investment education');
      expect(systemPrompt).toContain('portfolio insights');

      // Context inclusion
      expect(systemPrompt).toContain(address);
      expect(systemPrompt).toContain(financialContext);

      // Educational focus
      expect(systemPrompt).toContain('educational assistant');
      expect(systemPrompt).toContain('not a transaction executor');
    });
  });

  describe('Financial Context Generation (Req 10.3, 10.9)', () => {
    it('should handle chain read failures gracefully without fabrication', async () => {
      const address = '0x1234567890123456789012345678901234567890';

      // Access private method for testing
      const financialContext = await (service as any).getUserFinancialContext(address);

      // Should mark as unavailable, not fabricate values (Req 10.9)
      expect(financialContext).toContain('unavailable');
      expect(financialContext).toContain('unable to read from blockchain');
      
      // Should not contain any fabricated numeric values
      expect(financialContext).not.toMatch(/\b\d+\b/); // No standalone numbers
      expect(financialContext).not.toContain('1000');
      expect(financialContext).not.toContain('balance: 0');
    });

    it('should include all expected financial data types', async () => {
      const address = '0x1234567890123456789012345678901234567890';

      const financialContext = await (service as any).getUserFinancialContext(address);

      // Should attempt to read all required data types
      expect(financialContext).toContain('Available savings balance');
      expect(financialContext).toContain('Total portfolio value');
      expect(financialContext).toContain('User reputation score');
    });
  });

  describe('Conversation Management (Req 10.4)', () => {
    it('should provide conversation history interface', async () => {
      const userId = 'test-user';

      // Should not throw when getting conversations
      const conversations = await service.getConversations(userId);
      expect(Array.isArray(conversations)).toBe(true);
    });

    it('should handle conversation retrieval', async () => {
      const userId = 'test-user';
      const conversationId = 'test-conv-id';

      // Should handle case where conversation doesn't exist
      const result = await service.getConversation(userId, conversationId);
      expect(result).toBeNull(); // Conversation not found
    });
  });
});