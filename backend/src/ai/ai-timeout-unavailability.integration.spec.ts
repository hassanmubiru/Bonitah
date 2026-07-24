import { 
  BadRequestException,
  ServiceUnavailableException 
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { EnvService } from '../config/env.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChainReadService } from '../chain-read/chain-read.service';

/**
 * Integration tests for AI timeout and unavailability handling.
 * 
 * Tests requirements:
 * - 30s timeout enforcement with retained history (Req 10.8)
 * - Service unavailability handling with proper error response (Req 10.8)
 * - Unavailable on-chain figure handling without fabrication (Req 10.9)
 * - Error handling preserves conversation history (Req 10.4, 10.8)
 * - ServiceUnavailableException (503) response format
 */
describe('AI Timeout and Unavailability Integration', () => {
  let service: AiService;
  let mockPrismaService: any;
  let mockChainReadService: any;
  let mockConversation: any;

  beforeEach(async () => {
    mockConversation = {
      id: 'test-conversation-id',
      userId: 'test-user-id',
      createdAt: new Date(),
    };

    mockPrismaService = {
      conversation: {
        findFirst: jest.fn().mockResolvedValue(mockConversation),
        create: jest.fn().mockResolvedValue(mockConversation),
        findMany: jest.fn().mockResolvedValue([]),
      },
      message: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
          id: 'test-message-id',
          conversationId: mockConversation.id,
          role: 'user',
          content: 'test message',
          createdAt: new Date(),
        }),
      },
      $transaction: jest.fn().mockResolvedValue([{}, {}]),
    };

    mockChainReadService = {
      read: jest.fn(),
      clearCache: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: EnvService,
          useValue: {
            openaiApiKey: 'test-openai-key',
          },
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ChainReadService,
          useValue: mockChainReadService,
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  describe('30s Timeout Enforcement (Req 10.8)', () => {
    it('should timeout OpenAI requests after 30 seconds and preserve conversation history', async () => {
      const question = 'What is my balance?';
      const userId = 'test-user-id';
      const address = '0x742d35Cc6634C0532925a3b8D8Bc4e11B9E4a8ff';

      // Mock chain read to succeed (so timeout is only from OpenAI)
      mockChainReadService.read.mockResolvedValue({
        value: '1000',
        provenance: { blockNumber: 12345, fetchedAt: new Date() },
      });

      // Create a mock OpenAI client that takes longer than 30s
      const slowMockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockImplementation(() => {
              // Return a promise that resolves after 35 seconds (exceeds 30s timeout)
              return new Promise((resolve) => {
                setTimeout(() => {
                  resolve({
                    choices: [{ message: { content: 'This response is too slow' } }],
                  });
                }, 35000); // 35 seconds - exceeds timeout
              });
            }),
          },
        },
      };

      // Replace OpenAI instance
      (service as any).openai = slowMockOpenAI;

      // Expect ServiceUnavailableException due to timeout
      await expect(service.chat(userId, address, question))
        .rejects.toThrow(ServiceUnavailableException);

      // Verify timeout-specific error message
      try {
        await service.chat(userId, address, question);
        fail('Should have thrown ServiceUnavailableException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expect(error.message).toContain('timed out');
      }

      // Verify conversation was still created/found (history preserved)
      expect(mockPrismaService.conversation.findFirst).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    }, 40000); // Set Jest timeout to 40s to allow for the 35s mock delay

    it('should enforce exact 30-second timeout boundary', async () => {
      const question = 'Explain investment principles';
      const userId = 'test-user-id';
      const address = '0x742d35Cc6634C0532925a3b8D8Bc4e11B9E4a8ff';

      // Mock successful chain read
      mockChainReadService.read.mockResolvedValue({
        value: '500',
        provenance: { blockNumber: 12345, fetchedAt: new Date() },
      });

      // Test timeout at exactly 30 seconds
      const exactTimeoutMockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockImplementation(() => {
              return new Promise((resolve) => {
                setTimeout(() => {
                  resolve({
                    choices: [{ message: { content: 'Response at 30s boundary' } }],
                  });
                }, 30000); // Exactly 30 seconds
              });
            }),
          },
        },
      };

      (service as any).openai = exactTimeoutMockOpenAI;

      const startTime = Date.now();

      await expect(service.chat(userId, address, question))
        .rejects.toThrow(ServiceUnavailableException);

      const elapsed = Date.now() - startTime;

      // Should timeout at approximately 30 seconds (allow small variance)
      expect(elapsed).toBeGreaterThanOrEqual(29000); // At least 29s
      expect(elapsed).toBeLessThan(32000); // Less than 32s
    }, 35000);

    it('should not timeout for requests completing within 30 seconds', async () => {
      const question = 'Quick balance check';
      const userId = 'test-user-id';
      const address = '0x742d35Cc6634C0532925a3b8D8Bc4e11B9E4a8ff';

      // Mock successful chain read
      mockChainReadService.read.mockResolvedValue({
        value: '750',
        provenance: { blockNumber: 12345, fetchedAt: new Date() },
      });

      // Create fast-responding OpenAI mock
      const fastMockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockImplementation(() => {
              return new Promise((resolve) => {
                setTimeout(() => {
                  resolve({
                    choices: [{ message: { content: 'Fast response within timeout' } }],
                  });
                }, 5000); // 5 seconds - well within timeout
              });
            }),
          },
        },
      };

      (service as any).openai = fastMockOpenAI;

      // Should succeed without timeout
      const result = await service.chat(userId, address, question);

      expect(result).toBeDefined();
      expect(result.answer).toBe('Fast response within timeout');
      expect(result.conversationId).toBe(mockConversation.id);

      // Verify messages were stored (history preserved)
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    }, 15000);
  });

  describe('Service Unavailability (Req 10.8)', () => {
    it('should return 503 ServiceUnavailableException when OpenAI is not configured', async () => {
      const question = 'What should I know about saving?';
      const userId = 'test-user-id';
      const address = '0x742d35Cc6634C0532925a3b8D8Bc4e11B9E4a8ff';

      // Create service with no OpenAI configuration
      const moduleWithoutOpenAI: TestingModule = await Test.createTestingModule({
        providers: [
          AiService,
          {
            provide: EnvService,
            useValue: {
              openaiApiKey: undefined, // No API key
            },
          },
          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
          {
            provide: ChainReadService,
            useValue: mockChainReadService,
          },
        ],
      }).compile();

      const unconfiguredService = moduleWithoutOpenAI.get<AiService>(AiService);

      await expect(unconfiguredService.chat(userId, address, question))
        .rejects.toThrow(ServiceUnavailableException);

      try {
        await unconfiguredService.chat(userId, address, question);
        fail('Should have thrown ServiceUnavailableException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expect(error.message).toContain('temporarily unavailable');
        expect(error.message).toContain('not configured');
        
        // Verify it's a 503 error (ServiceUnavailableException defaults to 503)
        expect(error.getStatus()).toBe(503);
      }
    });

    it('should return 503 when OpenAI API returns errors', async () => {
      const question = 'Help me understand budgeting';
      const userId = 'test-user-id';
      const address = '0x742d35Cc6634C0532925a3b8D8Bc4e11B9E4a8ff';

      // Mock successful chain read
      mockChainReadService.read.mockResolvedValue({
        value: '1200',
        provenance: { blockNumber: 12345, fetchedAt: new Date() },
      });

      // Mock OpenAI API error
      const errorMockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('OpenAI API rate limit exceeded')),
          },
        },
      };

      (service as any).openai = errorMockOpenAI;

      await expect(service.chat(userId, address, question))
        .rejects.toThrow(ServiceUnavailableException);

      try {
        await service.chat(userId, address, question);
        fail('Should have thrown ServiceUnavailableException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expect(error.message).toContain('temporarily unavailable');
        expect(error.getStatus()).toBe(503);
      }
    });

    it('should preserve conversation history on service errors', async () => {
      const question = 'Investment education please';
      const userId = 'test-user-id';
      const address = '0x742d35Cc6634C0532925a3b8D8Bc4e11B9E4a8ff';

      // Mock chain read to succeed
      mockChainReadService.read.mockResolvedValue({
        value: '800',
        provenance: { blockNumber: 12345, fetchedAt: new Date() },
      });

      // Mock OpenAI to fail
      const failingMockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('Service temporarily down')),
          },
        },
      };

      (service as any).openai = failingMockOpenAI;

      await expect(service.chat(userId, address, question))
        .rejects.toThrow(ServiceUnavailableException);

      // Verify conversation was still found/created (Req 10.4, 10.8)
      expect(mockPrismaService.conversation.findFirst).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      // Verify user's financial context was still retrieved
      expect(mockChainReadService.read).toHaveBeenCalled();

      // Verify NO message was stored due to failure (proper cleanup)
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('Unavailable On-chain Figure Handling (Req 10.9)', () => {
    it('should handle unavailable on-chain data without fabrication', async () => {
      const question = 'What is my current financial status?';
      const userId = 'test-user-id';
      const address = '0x742d35Cc6634C0532925a3b8D8Bc4e11B9E4a8ff';

      // Mock all chain reads to fail
      mockChainReadService.read.mockRejectedValue(new Error('Network unavailable'));

      // Mock OpenAI to return successful response
      const successMockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: 'I cannot access your current balances due to network issues. Please try again later.',
                  },
                },
              ],
            }),
          },
        },
      };

      (service as any).openai = successMockOpenAI;

      const result = await service.chat(userId, address, question);

      expect(result).toBeDefined();
      expect(result.answer).toBeDefined();

      // Verify the system prompt would have contained 'unavailable' markers
      // Get the system prompt that was generated
      const systemPromptCall = successMockOpenAI.chat.completions.create.mock.calls[0][0];
      const systemMessage = systemPromptCall.messages.find((msg: any) => msg.role === 'system');
      
      expect(systemMessage).toBeDefined();
      expect(systemMessage.content).toContain('unavailable');
      expect(systemMessage.content).toContain('unable to read from blockchain');

      // Verify no fabricated values are present (Req 10.9)
      expect(systemMessage.content).not.toMatch(/balance: \$?\d+/i);
      expect(systemMessage.content).not.toMatch(/portfolio: \$?\d+/i);
      expect(systemMessage.content).not.toMatch(/reputation: \d+/i);
    });

    it('should handle partial on-chain data availability correctly', async () => {
      const question = 'Show me my portfolio summary';
      const userId = 'test-user-id';
      const address = '0x742d35Cc6634C0532925a3b8D8Bc4e11B9E4a8ff';

      // Mock some reads to succeed, others to fail
      let callCount = 0;
      mockChainReadService.read.mockImplementation((params: any) => {
        callCount++;
        if (callCount === 1) {
          // First call (savings balance) succeeds
          return Promise.resolve({
            value: '1500',
            provenance: { blockNumber: 12345, fetchedAt: new Date() },
          });
        } else {
          // Subsequent calls fail
          return Promise.reject(new Error('Contract call failed'));
        }
      });

      const mixedMockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: 'I can see your savings balance but other data is currently unavailable.',
                  },
                },
              ],
            }),
          },
        },
      };

      (service as any).openai = mixedMockOpenAI;

      const result = await service.chat(userId, address, question);

      expect(result).toBeDefined();

      // Check the system prompt had mixed availability
      const systemPromptCall = mixedMockOpenAI.chat.completions.create.mock.calls[0][0];
      const systemMessage = systemPromptCall.messages.find((msg: any) => msg.role === 'system');

      expect(systemMessage.content).toContain('Available savings balance: 1500');
      expect(systemMessage.content).toContain('Total portfolio value: unavailable');
      expect(systemMessage.content).toContain('User reputation score: unavailable');
    });

    it('should never fabricate placeholder values on read failure', async () => {
      const question = 'What are my account details?';
      const userId = 'test-user-id';
      const address = '0x742d35Cc6634C0532925a3b8D8Bc4e11B9E4a8ff';

      // Mock complete chain read failure
      mockChainReadService.read.mockRejectedValue(new Error('All endpoints down'));

      const placeholderCheckMockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: 'Your account data is currently unavailable due to network issues.',
                  },
                },
              ],
            }),
          },
        },
      };

      (service as any).openai = placeholderCheckMockOpenAI;

      await service.chat(userId, address, question);

      // Get the generated financial context directly
      const financialContext = await (service as any).getUserFinancialContext(address);

      // Verify no placeholder/fabricated values (Req 10.9)
      const commonPlaceholders = [
        'balance: 0',
        'balance: $0',
        'portfolio: 0', 
        'portfolio: $0',
        'reputation: 0',
        'balance: TBD',
        'balance: N/A',
        'coming soon',
        'calculating',
        'loading',
        'pending'
      ];

      commonPlaceholders.forEach(placeholder => {
        expect(financialContext.toLowerCase()).not.toContain(placeholder.toLowerCase());
      });

      // Should explicitly state unavailability
      expect(financialContext).toContain('unavailable');
      expect(financialContext).toContain('unable to read from blockchain');
    });
  });

  describe('Error Response Format (Req 10.8)', () => {
    it('should return consistent ServiceUnavailableException format', async () => {
      const question = 'Help with my finances';
      const userId = 'test-user-id';
      const address = '0x742d35Cc6634C0532925a3b8D8Bc4e11B9E4a8ff';

      // Mock OpenAI failure
      const errorMockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('Service error')),
          },
        },
      };

      (service as any).openai = errorMockOpenAI;

      try {
        await service.chat(userId, address, question);
        fail('Should have thrown ServiceUnavailableException');
      } catch (error: any) {
        // Verify error type and status
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expect(error.getStatus()).toBe(503);
        
        // Verify error message format
        expect(error.message).toContain('temporarily unavailable');
        expect(error.message).toContain('try again later');
        
        // Should not expose internal error details
        expect(error.message).not.toContain('Service error');
        expect(error.message).not.toContain('OpenAI');
        expect(error.message).not.toContain('API');
      }
    });

    it('should distinguish between validation errors and service errors', async () => {
      const longQuestion = 'x'.repeat(2001); // Exceeds length limit
      const userId = 'test-user-id';
      const address = '0x742d35Cc6634C0532925a3b8D8Bc4e11B9E4a8ff';

      // Even if service is unavailable, validation should happen first
      (service as any).openai = null; // Service unavailable

      await expect(service.chat(userId, address, longQuestion))
        .rejects.toThrow(BadRequestException);

      // Should get validation error (400), not service unavailable (503)
      try {
        await service.chat(userId, address, longQuestion);
        fail('Should have thrown BadRequestException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.getStatus()).toBe(400);
        expect(error.message).toContain('2000 characters');
        
        // Should not be ServiceUnavailableException
        expect(error).not.toBeInstanceOf(ServiceUnavailableException);
      }
    });
  });

  describe('Conversation History Preservation (Req 10.4, 10.8)', () => {
    it('should preserve conversation context even when AI service fails', async () => {
      const question = 'Explain compound interest';
      const userId = 'test-user-id';
      const address = '0x742d35Cc6634C0532925a3b8D8Bc4e11B9E4a8ff';

      // Mock existing conversation with history
      const existingMessages = [
        {
          id: 'msg-1',
          conversationId: mockConversation.id,
          role: 'user',
          content: 'Previous question',
          createdAt: new Date(Date.now() - 60000),
        },
        {
          id: 'msg-2',  
          conversationId: mockConversation.id,
          role: 'assistant',
          content: 'Previous answer',
          createdAt: new Date(Date.now() - 55000),
        },
      ];

      mockPrismaService.message.findMany.mockResolvedValue(existingMessages);

      // Mock service to fail
      (service as any).openai = null;

      await expect(service.chat(userId, address, question))
        .rejects.toThrow(ServiceUnavailableException);

      // Verify conversation lookup was attempted (history preserved)
      expect(mockPrismaService.conversation.findFirst).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      // Verify history retrieval was attempted
      expect(mockPrismaService.message.findMany).toHaveBeenCalled();
    });

    it('should maintain conversation access during service outages', async () => {
      const userId = 'test-user-id';

      // Service unavailable for chat
      (service as any).openai = null;

      // But conversation history should still be accessible
      const conversations = await service.getConversations(userId);
      expect(conversations).toBeDefined();
      expect(Array.isArray(conversations)).toBe(true);

      const conversationId = mockConversation.id;
      mockPrismaService.conversation.findFirst.mockResolvedValue({
        ...mockConversation,
        messages: [
          { role: 'user', content: 'Old question', createdAt: new Date() },
          { role: 'assistant', content: 'Old answer', createdAt: new Date() },
        ],
      });

      const conversation = await service.getConversation(userId, conversationId);
      expect(conversation).toBeDefined();

      // History access should work even when AI is down
      expect(mockPrismaService.conversation.findFirst).toHaveBeenCalled();
    });
  });
});