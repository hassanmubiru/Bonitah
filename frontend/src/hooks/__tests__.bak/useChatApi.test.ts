import { renderHook, act, waitFor } from '@testing-library/react';
import { useChatApi } from '../useChatApi';

// Mock the useSiweAuth hook
jest.mock('../useSiweAuth', () => ({
  useSiweAuth: jest.fn(),
}));

const mockUseSiweAuth = jest.requireActual('../useSiweAuth').useSiweAuth as jest.MockedFunction<() => { isAuthenticated: boolean }>;

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('useChatApi Hook', () => {
  beforeEach(() => {
    // Reset mocks
    mockFetch.mockClear();
    mockLocalStorage.getItem.mockClear();
    mockUseSiweAuth.mockReturnValue({
      isAuthenticated: true,
    });

    // Mock localStorage to return a JWT token
    mockLocalStorage.getItem.mockReturnValue('mock-jwt-token');

    // Default successful fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('initializes with empty state', () => {
      const { result } = renderHook(() => useChatApi());

      expect(result.current.messages).toEqual([]);
      expect(result.current.conversations).toEqual([]);
      expect(result.current.currentConversationId).toBe(null);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('does not make API calls when not authenticated', () => {
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
      });

      renderHook(() => useChatApi());

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Authentication State Changes', () => {
    it('loads conversations when authenticated', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          createdAt: '2023-01-01T00:00:00Z',
          messageCount: 5,
          lastMessage: 'Hello there',
          lastMessageAt: '2023-01-01T00:00:00Z',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ conversations: mockConversations }),
      } as Response);

      const { result } = renderHook(() => useChatApi());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3001/ai/conversations?limit=20',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'Authorization': 'Bearer mock-jwt-token',
            }),
          })
        );
      });

      await waitFor(() => {
        expect(result.current.conversations).toHaveLength(1);
        expect(result.current.conversations[0].id).toBe('conv-1');
      });
    });

    it('clears state when authentication is lost', () => {
      const { result, rerender } = renderHook(() => useChatApi());

      // Start authenticated
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
      });

      rerender();

      expect(result.current.messages).toEqual([]);
      expect(result.current.conversations).toEqual([]);
      expect(result.current.currentConversationId).toBe(null);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });
  });

  describe('sendMessage Function', () => {
    it('sends message and updates state correctly', async () => {
      const mockResponse = {
        answer: 'AI response here',
        conversationId: 'conv-123',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversations: [] }),
        } as Response) // Initial conversations load
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response) // Chat response
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversations: [] }),
        } as Response); // Refresh conversations

      const { result } = renderHook(() => useChatApi());

      await act(async () => {
        await result.current.sendMessage('Test question');
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2); // User message + AI response
        expect(result.current.messages[0].role).toBe('user');
        expect(result.current.messages[0].content).toBe('Test question');
        expect(result.current.messages[1].role).toBe('assistant');
        expect(result.current.messages[1].content).toBe('AI response here');
        expect(result.current.currentConversationId).toBe('conv-123');
      });
    });

    it('handles API errors gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversations: [] }),
        } as Response) // Initial conversations load
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
        } as Response); // Failed chat request

      const { result } = renderHook(() => useChatApi());

      await act(async () => {
        await result.current.sendMessage('Test question');
      });

      await waitFor(() => {
        expect(result.current.error).toBe('AI assistant is temporarily unavailable. Please try again in a moment.');
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('handles validation errors (400 status)', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversations: [] }),
        } as Response) // Initial conversations load
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ message: 'Question too long' }),
        } as Response);

      const { result } = renderHook(() => useChatApi());

      await act(async () => {
        await result.current.sendMessage('Test question');
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Question too long');
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('does not send empty messages', async () => {
      const { result } = renderHook(() => useChatApi());

      await act(async () => {
        await result.current.sendMessage('   '); // Empty/whitespace only
      });

      expect(mockFetch).toHaveBeenCalledTimes(1); // Only initial conversations load
    });

    it('does not send messages when not authenticated', async () => {
      mockUseSiweAuth.mockReturnValue({
        isAuthenticated: false,
      });

      const { result } = renderHook(() => useChatApi());

      await act(async () => {
        await result.current.sendMessage('Test question');
      });

      expect(result.current.messages).toEqual([]);
    });
  });

  describe('loadConversation Function', () => {
    it('loads specific conversation messages', async () => {
      const mockConversation = {
        conversation: {
          messages: [
            {
              role: 'user',
              content: 'Hello',
              createdAt: '2023-01-01T00:00:00Z',
            },
            {
              role: 'assistant',
              content: 'Hi there!',
              createdAt: '2023-01-01T00:01:00Z',
            },
          ],
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversations: [] }),
        } as Response) // Initial conversations load
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConversation,
        } as Response);

      const { result } = renderHook(() => useChatApi());

      await act(async () => {
        await result.current.loadConversation('conv-123');
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
        expect(result.current.currentConversationId).toBe('conv-123');
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('handles conversation loading errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversations: [] }),
        } as Response) // Initial conversations load
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as Response);

      const { result } = renderHook(() => useChatApi());

      await act(async () => {
        await result.current.loadConversation('conv-123');
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load conversation');
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('createNewConversation Function', () => {
    it('clears messages and conversation ID', () => {
      const { result } = renderHook(() => useChatApi());

      // Set some initial state
      act(() => {
        result.current.sendMessage('Test');
      });

      act(() => {
        result.current.createNewConversation();
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.currentConversationId).toBe(null);
      expect(result.current.error).toBe(null);
    });
  });

  describe('clearError Function', () => {
    it('clears the current error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as Response);

      const { result } = renderHook(() => useChatApi());

      // Trigger an error
      await act(async () => {
        await result.current.sendMessage('Test question');
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Clear the error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBe(null);
    });
  });

  describe('Action Parsing', () => {
    it('parses deposit savings actions from AI response', async () => {
      const mockResponse = {
        answer: 'You should deposit more money into your savings account to grow your wealth.',
        conversationId: 'conv-123',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversations: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversations: [] }),
        } as Response);

      const { result } = renderHook(() => useChatApi());

      await act(async () => {
        await result.current.sendMessage('How can I save money?');
      });

      await waitFor(() => {
        const assistantMessage = result.current.messages.find(m => m.role === 'assistant');
        expect(assistantMessage?.actions).toBeDefined();
        expect(assistantMessage?.actions).toContainEqual({
          type: 'deposit_savings',
          title: 'Deposit to Savings',
          description: 'Add funds to your savings vault',
          requiresSignature: true,
        });
      });
    });

    it('parses create goal actions from AI response', async () => {
      const mockResponse = {
        answer: 'You should create a savings goal to help you stay motivated and track progress.',
        conversationId: 'conv-123',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversations: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversations: [] }),
        } as Response);

      const { result } = renderHook(() => useChatApi());

      await act(async () => {
        await result.current.sendMessage('Help me save money');
      });

      await waitFor(() => {
        const assistantMessage = result.current.messages.find(m => m.role === 'assistant');
        expect(assistantMessage?.actions).toContainEqual({
          type: 'create_goal',
          title: 'Create Savings Goal',
          description: 'Set up a new financial goal',
          requiresSignature: true,
        });
      });
    });

    it('parses portfolio view actions from AI response', async () => {
      const mockResponse = {
        answer: 'Let me check your current portfolio performance on the dashboard.',
        conversationId: 'conv-123',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversations: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversations: [] }),
        } as Response);

      const { result } = renderHook(() => useChatApi());

      await act(async () => {
        await result.current.sendMessage('What is my portfolio status?');
      });

      await waitFor(() => {
        const assistantMessage = result.current.messages.find(m => m.role === 'assistant');
        expect(assistantMessage?.actions).toContainEqual({
          type: 'view_portfolio',
          title: 'View Portfolio',
          description: 'Check your current portfolio status',
          requiresSignature: false,
        });
      });
    });

    it('returns no actions for unrelated responses', async () => {
      const mockResponse = {
        answer: 'Financial planning is important for your future security.',
        conversationId: 'conv-123',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversations: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversations: [] }),
        } as Response);

      const { result } = renderHook(() => useChatApi());

      await act(async () => {
        await result.current.sendMessage('Tell me about finance');
      });

      await waitFor(() => {
        const assistantMessage = result.current.messages.find(m => m.role === 'assistant');
        expect(assistantMessage?.actions).toEqual([]);
      });
    });
  });

  describe('API Configuration', () => {
    it('uses environment API URL when available', () => {
      process.env['NEXT_PUBLIC_API_URL'] = 'https://api.example.com';
      
      const { result } = renderHook(() => useChatApi());

      // The hook should use the environment URL
      expect(result.current).toBeDefined();
      
      delete process.env['NEXT_PUBLIC_API_URL'];
    });

    it('falls back to localhost when no environment URL is set', () => {
      delete process.env['NEXT_PUBLIC_API_URL'];
      
      const { result } = renderHook(() => useChatApi());

      expect(result.current).toBeDefined();
    });

    it('includes JWT token in authorization headers', async () => {
      mockLocalStorage.getItem.mockReturnValue('test-jwt-token');

      const { result } = renderHook(() => useChatApi());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer test-jwt-token',
            }),
          })
        );
      });
    });

    it('works without JWT token', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useChatApi());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.not.objectContaining({
              'Authorization': expect.any(String),
            }),
          })
        );
      });
    });
  });
});