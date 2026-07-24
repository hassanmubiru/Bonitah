import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { EnvService } from '../config/env.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChainReadService } from '../chain-read/chain-read.service';

describe('AiService', () => {
  let service: AiService;
  let mockEnvService: jest.Mocked<EnvService>;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockChainReadService: jest.Mocked<ChainReadService>;

  beforeEach(async () => {
    // Create mocks
    mockEnvService = {
      openaiApiKey: 'test-api-key',
    } as jest.Mocked<EnvService>;

    mockPrismaService = {
      conversation: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      message: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    } as any;

    mockChainReadService = {
      read: jest.fn(),
      clearCache: jest.fn(),
    } as jest.Mocked<ChainReadService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: EnvService, useValue: mockEnvService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ChainReadService, useValue: mockChainReadService },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Question Length Validation (Req 10.7)', () => {
    it('should accept questions up to 2000 characters', async () => {
      const question = 'x'.repeat(2000);
      const userId = 'user123';
      const address = '0x1234567890123456789012345678901234567890';

      // Mock conversation and chain read
      mockPrismaService.conversation.findFirst.mockResolvedValue({
        id: 'conv123',
        userId,
        createdAt: new Date(),
      });

      mockChainReadService.read.mockResolvedValue({
        value: '1000',
        provenance: {
          contractAddress: '0xabc',
          blockNumber: 123n,
          fetchedAt: new Date().toISOString(),
        },
      });

      mockPrismaService.message.findMany.mockResolvedValue([]);
      mockPrismaService.$transaction.mockResolvedValue([{}, {}]);

      // Since OpenAI isn't actually configured in test, this should fail with service unavailable
      await expect(service.chat(userId, address, question))
        .rejects.toThrow(ServiceUnavailableException);
    });

    it('should reject questions exceeding 2000 characters (Req 10.7)', async () => {
      const question = 'x'.repeat(2001);
      const userId = 'user123';
      const address = '0x1234567890123456789012345678901234567890';

      await expect(service.chat(userId, address, question))
        .rejects.toThrow(BadRequestException);

      const error = await service.chat(userId, address, question)
        .catch(err => err);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.message).toContain('2000 characters');
      expect(error.message).toContain('current: 2001');
    });

    it('should accept empty questions', async () => {
      const question = '';
      const userId = 'user123';
      const address = '0x1234567890123456789012345678901234567890';

      // Mock conversation
      mockPrismaService.conversation.findFirst.mockResolvedValue({
        id: 'conv123',
        userId,
        createdAt: new Date(),
      });

      mockChainReadService.read.mockResolvedValue({
        value: '1000',
        provenance: {
          contractAddress: '0xabc',
          blockNumber: 123n,
          fetchedAt: new Date().toISOString(),
        },
      });

      mockPrismaService.message.findMany.mockResolvedValue([]);
      mockPrismaService.$transaction.mockResolvedValue([{}, {}]);

      // Should not throw validation error for empty question
      await expect(service.chat(userId, address, question))
        .rejects.toThrow(ServiceUnavailableException); // Due to missing OpenAI config, not validation
    });
  });

  describe('Service Unavailability Handling (Req 10.8)', () => {
    it('should return service unavailable when OpenAI is not configured', async () => {
      // Create service without OpenAI API key
      const envWithoutOpenAI = {
        openaiApiKey: undefined,
      } as jest.Mocked<EnvService>;
      
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AiService,
          { provide: EnvService, useValue: envWithoutOpenAI },
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ChainReadService, useValue: mockChainReadService },
        ],
      }).compile();

      const serviceWithoutOpenAI = module.get<AiService>(AiService);

      const question = 'What is my balance?';
      const userId = 'user123';
      const address = '0x1234567890123456789012345678901234567890';

      await expect(serviceWithoutOpenAI.chat(userId, address, question))
        .rejects.toThrow(ServiceUnavailableException);

      const error = await serviceWithoutOpenAI.chat(userId, address, question)
        .catch(err => err);

      expect(error.message).toContain('temporarily unavailable');
      expect(error.message).toContain('not configured');
    });
  });

  describe('On-Chain Data Integration (Req 10.3, 10.9)', () => {
    it('should handle chain read failures gracefully', async () => {
      const userId = 'user123';
      const address = '0x1234567890123456789012345678901234567890';

      // Mock conversation
      mockPrismaService.conversation.findFirst.mockResolvedValue({
        id: 'conv123',
        userId,
        createdAt: new Date(),
      });

      // Mock chain read failures
      mockChainReadService.read.mockRejectedValue(new Error('Network error'));

      const financialContext = await (service as any).getUserFinancialContext(address);

      // Should indicate unavailable data without fabrication (Req 10.9)
      expect(financialContext).toContain('unavailable');
      expect(financialContext).toContain('unable to read from blockchain');
      expect(financialContext).not.toContain('1000'); // No fabricated values
    });

    it('should include on-chain data when reads succeed', async () => {
      const address = '0x1234567890123456789012345678901234567890';

      // Mock successful chain reads
      mockChainReadService.read
        .mockResolvedValueOnce({
          value: '1000',
          provenance: {
            contractAddress: '0xabc',
            blockNumber: 123n,
            fetchedAt: new Date().toISOString(),
          },
        })
        .mockResolvedValueOnce({
          value: '2000',
          provenance: {
            contractAddress: '0xdef',
            blockNumber: 123n,
            fetchedAt: new Date().toISOString(),
          },
        })
        .mockResolvedValueOnce({
          value: '50',
          provenance: {
            contractAddress: '0xghi',
            blockNumber: 123n,
            fetchedAt: new Date().toISOString(),
          },
        });

      const financialContext = await (service as any).getUserFinancialContext(address);

      expect(financialContext).toContain('Available savings balance: 1000 tokens');
      expect(financialContext).toContain('Total portfolio value: 2000 tokens');
      expect(financialContext).toContain('User reputation score: 50');
      expect(financialContext).toContain('block 123');
    });
  });

  describe('System Prompt (Req 10.1, 10.2)', () => {
    it('should build system prompt with transaction prohibition', () => {
      const financialContext = 'Test context';
      const address = '0x1234567890123456789012345678901234567890';

      const systemPrompt = (service as any).buildSystemPrompt(financialContext, address);

      // Should include transaction prohibition (Req 10.2)
      expect(systemPrompt).toContain('NEVER initiate, sign, or submit blockchain transactions');
      expect(systemPrompt).toContain('NEVER provide specific investment advice');
      expect(systemPrompt).toContain('NEVER ask for or handle private keys');

      // Should scope to allowed topics (Req 10.1)
      expect(systemPrompt).toContain('budgeting guidance');
      expect(systemPrompt).toContain('savings strategies');
      expect(systemPrompt).toContain('investment education');
      expect(systemPrompt).toContain('portfolio insights');

      // Should include user context
      expect(systemPrompt).toContain(address);
      expect(systemPrompt).toContain(financialContext);
    });
  });

  describe('Conversation History (Req 10.4)', () => {
    it('should create new conversation if none exists', async () => {
      const userId = 'user123';

      mockPrismaService.conversation.findFirst.mockResolvedValue(null);
      mockPrismaService.conversation.create.mockResolvedValue({
        id: 'new-conv',
        userId,
        createdAt: new Date(),
      });

      const conversation = await (service as any).getOrCreateConversation(userId);

      expect(mockPrismaService.conversation.create).toHaveBeenCalledWith({
        data: { userId },
      });
      expect(conversation.id).toBe('new-conv');
    });

    it('should return existing conversation if found', async () => {
      const userId = 'user123';
      const existingConversation = {
        id: 'existing-conv',
        userId,
        createdAt: new Date(),
      };

      mockPrismaService.conversation.findFirst.mockResolvedValue(existingConversation);

      const conversation = await (service as any).getOrCreateConversation(userId);

      expect(mockPrismaService.conversation.create).not.toHaveBeenCalled();
      expect(conversation.id).toBe('existing-conv');
    });

    it('should get conversations list', async () => {
      const userId = 'user123';
      const mockConversations = [
        {
          id: 'conv1',
          createdAt: new Date('2024-01-01'),
          messages: [
            { content: 'Latest message', createdAt: new Date('2024-01-01T10:00:00Z') }
          ],
        },
        {
          id: 'conv2',
          createdAt: new Date('2024-01-02'),
          messages: [],
        },
      ];

      mockPrismaService.conversation.findMany.mockResolvedValue(mockConversations);

      const result = await service.getConversations(userId, 10);

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('conv1');
      expect(result[0]?.lastMessage).toBe('Latest message');
      expect(result[1]?.id).toBe('conv2');
      expect(result[1]?.lastMessage).toBeNull();
    });
  });
});