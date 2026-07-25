import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import AiAssistantPage from '../page';

// Mock the hooks
jest.mock('@/hooks/useAuthGuard', () => ({
  useAuthGuard: jest.fn(),
}));

jest.mock('@/hooks/useChatApi', () => ({
  useChatApi: jest.fn(),
}));

// Mock the components
jest.mock('@/components/ai/ActionButton', () => ({
  ActionButtons: ({ actions }: { actions: unknown[] }) => (
    <div data-testid="action-buttons">
      {actions.length} actions
    </div>
  ),
}));

const mockUseAuthGuard = jest.requireActual('@/hooks/useAuthGuard').useAuthGuard as jest.MockedFunction<typeof import('@/hooks/useAuthGuard').useAuthGuard>;
const mockUseChatApi = jest.requireActual('@/hooks/useChatApi').useChatApi as jest.MockedFunction<typeof import('@/hooks/useChatApi').useChatApi>;

describe('AI Assistant Page', () => {
  beforeEach(() => {
    // Default mocks
    mockUseAuthGuard.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    mockUseChatApi.mockReturnValue({
      messages: [],
      conversations: [],
      currentConversationId: null,
      isLoading: false,
      error: null,
      sendMessage: jest.fn(),
      loadConversation: jest.fn(),
      createNewConversation: jest.fn(),
      clearError: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication States', () => {
    it('shows loading state when auth is loading', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
      });

      render(<AiAssistantPage />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('renders main interface when authenticated', () => {
      render(<AiAssistantPage />);

      expect(screen.getByText('AI Financial Assistant')).toBeInTheDocument();
      expect(screen.getByText('Get personalized financial guidance and smart recommendations for your BFN portfolio')).toBeInTheDocument();
    });

    it('returns null when not authenticated (handled by auth guard)', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      });

      const { container } = render(<AiAssistantPage />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Chat Interface', () => {
    it('displays welcome message when no messages', () => {
      render(<AiAssistantPage />);

      expect(screen.getByText('Welcome to your AI Financial Assistant')).toBeInTheDocument();
      expect(screen.getByText(/Ask questions about your portfolio/)).toBeInTheDocument();
    });

    it('shows conversation sidebar with new chat button', () => {
      render(<AiAssistantPage />);

      expect(screen.getByText('Conversations')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument();
    });

    it('displays existing conversations', () => {
      mockUseChatApi.mockReturnValue({
        messages: [],
        conversations: [
          {
            id: 'conv-1',
            createdAt: new Date('2023-01-01'),
            messageCount: 5,
            lastMessage: 'What is my portfolio performance?',
            lastMessageAt: new Date('2023-01-01'),
          },
        ],
        currentConversationId: null,
        isLoading: false,
        error: null,
        sendMessage: jest.fn(),
        loadConversation: jest.fn(),
        createNewConversation: jest.fn(),
        clearError: jest.fn(),
      });

      render(<AiAssistantPage />);

      expect(screen.getByText('What is my portfolio performance?')).toBeInTheDocument();
      expect(screen.getByText('5 messages')).toBeInTheDocument();
    });

    it('handles conversation selection', async () => {
      const mockLoadConversation = jest.fn();
      mockUseChatApi.mockReturnValue({
        messages: [],
        conversations: [
          {
            id: 'conv-1',
            createdAt: new Date('2023-01-01'),
            messageCount: 5,
            lastMessage: 'Test conversation',
            lastMessageAt: new Date('2023-01-01'),
          },
        ],
        currentConversationId: null,
        isLoading: false,
        error: null,
        sendMessage: jest.fn(),
        loadConversation: mockLoadConversation,
        createNewConversation: jest.fn(),
        clearError: jest.fn(),
      });

      render(<AiAssistantPage />);

      const conversationButton = screen.getByText('Test conversation');
      fireEvent.click(conversationButton);

      expect(mockLoadConversation).toHaveBeenCalledWith('conv-1');
    });
  });

  describe('Message Input and Sending', () => {
    it('renders message input with character count', () => {
      render(<AiAssistantPage />);

      const input = screen.getByPlaceholderText('Ask me anything about your finances...');
      expect(input).toBeInTheDocument();
      expect(screen.getByText('0/2000 characters')).toBeInTheDocument();
    });

    it('updates character count as user types', async () => {
      render(<AiAssistantPage />);

      const input = screen.getByPlaceholderText('Ask me anything about your finances...');
      fireEvent.change(input, { target: { value: 'Hello' } });

      await waitFor(() => {
        expect(screen.getByText('5/2000 characters')).toBeInTheDocument();
      });
    });

    it('sends message when form is submitted', async () => {
      const mockSendMessage = jest.fn();
      mockUseChatApi.mockReturnValue({
        messages: [],
        conversations: [],
        currentConversationId: null,
        isLoading: false,
        error: null,
        sendMessage: mockSendMessage,
        loadConversation: jest.fn(),
        createNewConversation: jest.fn(),
        clearError: jest.fn(),
      });

      render(<AiAssistantPage />);

      const input = screen.getByPlaceholderText('Ask me anything about your finances...');
      const sendButton = screen.getByRole('button', { name: /send message/i });

      fireEvent.change(input, { target: { value: 'Test question' } });
      fireEvent.click(sendButton);

      expect(mockSendMessage).toHaveBeenCalledWith('Test question');
    });

    it('sends message when Enter is pressed', async () => {
      const mockSendMessage = jest.fn();
      mockUseChatApi.mockReturnValue({
        messages: [],
        conversations: [],
        currentConversationId: null,
        isLoading: false,
        error: null,
        sendMessage: mockSendMessage,
        loadConversation: jest.fn(),
        createNewConversation: jest.fn(),
        clearError: jest.fn(),
      });

      render(<AiAssistantPage />);

      const input = screen.getByPlaceholderText('Ask me anything about your finances...');
      fireEvent.change(input, { target: { value: 'Test question' } });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

      expect(mockSendMessage).toHaveBeenCalledWith('Test question');
    });

    it('does not send message when Shift+Enter is pressed', () => {
      const mockSendMessage = jest.fn();
      mockUseChatApi.mockReturnValue({
        messages: [],
        conversations: [],
        currentConversationId: null,
        isLoading: false,
        error: null,
        sendMessage: mockSendMessage,
        loadConversation: jest.fn(),
        createNewConversation: jest.fn(),
        clearError: jest.fn(),
      });

      render(<AiAssistantPage />);

      const input = screen.getByPlaceholderText('Ask me anything about your finances...');
      fireEvent.change(input, { target: { value: 'Test question' } });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Message Display', () => {
    it('displays messages with proper styling and timestamps', () => {
      const testMessages = [
        {
          role: 'user' as const,
          content: 'Hello, AI!',
          createdAt: new Date('2023-01-01T10:00:00'),
        },
        {
          role: 'assistant' as const,
          content: 'Hello! How can I help you?',
          createdAt: new Date('2023-01-01T10:00:30'),
          actions: [],
        },
      ];

      mockUseChatApi.mockReturnValue({
        messages: testMessages,
        conversations: [],
        currentConversationId: 'conv-1',
        isLoading: false,
        error: null,
        sendMessage: jest.fn(),
        loadConversation: jest.fn(),
        createNewConversation: jest.fn(),
        clearError: jest.fn(),
      });

      render(<AiAssistantPage />);

      expect(screen.getByText('Hello, AI!')).toBeInTheDocument();
      expect(screen.getByText('Hello! How can I help you?')).toBeInTheDocument();
    });

    it('shows action buttons for assistant messages with actions', () => {
      const testMessages = [
        {
          role: 'assistant' as const,
          content: 'You should consider depositing to your savings.',
          createdAt: new Date('2023-01-01T10:00:30'),
          actions: [
            {
              type: 'deposit_savings' as const,
              title: 'Deposit to Savings',
              description: 'Add funds to savings',
              requiresSignature: true,
            },
          ],
        },
      ];

      mockUseChatApi.mockReturnValue({
        messages: testMessages,
        conversations: [],
        currentConversationId: 'conv-1',
        isLoading: false,
        error: null,
        sendMessage: jest.fn(),
        loadConversation: jest.fn(),
        createNewConversation: jest.fn(),
        clearError: jest.fn(),
      });

      render(<AiAssistantPage />);

      expect(screen.getByTestId('action-buttons')).toBeInTheDocument();
      expect(screen.getByText('1 actions')).toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
    it('shows typing indicator when loading', () => {
      mockUseChatApi.mockReturnValue({
        messages: [],
        conversations: [],
        currentConversationId: null,
        isLoading: true,
        error: null,
        sendMessage: jest.fn(),
        loadConversation: jest.fn(),
        createNewConversation: jest.fn(),
        clearError: jest.fn(),
      });

      render(<AiAssistantPage />);

      expect(screen.getByText('AI is thinking...')).toBeInTheDocument();
    });

    it('displays error message when there is an error', () => {
      mockUseChatApi.mockReturnValue({
        messages: [],
        conversations: [],
        currentConversationId: null,
        isLoading: false,
        error: 'Connection failed',
        sendMessage: jest.fn(),
        loadConversation: jest.fn(),
        createNewConversation: jest.fn(),
        clearError: jest.fn(),
      });

      render(<AiAssistantPage />);

      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });

    it('clears error when retry button is clicked', () => {
      const mockClearError = jest.fn();
      mockUseChatApi.mockReturnValue({
        messages: [],
        conversations: [],
        currentConversationId: null,
        isLoading: false,
        error: 'Connection failed',
        sendMessage: jest.fn(),
        loadConversation: jest.fn(),
        createNewConversation: jest.fn(),
        clearError: mockClearError,
      });

      render(<AiAssistantPage />);

      const retryButton = screen.getByRole('button', { name: 'Clear error and retry' });
      fireEvent.click(retryButton);

      expect(mockClearError).toHaveBeenCalled();
    });
  });

  describe('Quick Action Buttons', () => {
    it('shows quick action buttons in welcome state', () => {
      render(<AiAssistantPage />);

      expect(screen.getByText('Portfolio Summary')).toBeInTheDocument();
      expect(screen.getByText('Savings Tips')).toBeInTheDocument();
      expect(screen.getByText('Investment Ideas')).toBeInTheDocument();
    });

    it('fills input when quick action button is clicked', () => {
      render(<AiAssistantPage />);

      const portfolioButton = screen.getByText('Portfolio Summary');
      fireEvent.click(portfolioButton);

      const input = screen.getByPlaceholderText('Ask me anything about your finances...');
      expect(input).toHaveValue("What's my current portfolio performance?");
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<AiAssistantPage />);

      expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
      expect(screen.getByLabelText('Chat input')).toBeInTheDocument();
      expect(screen.getByLabelText('Send message')).toBeInTheDocument();
    });

    it('maintains proper heading hierarchy', () => {
      render(<AiAssistantPage />);

      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toHaveTextContent('AI Financial Assistant');
    });
  });

  describe('Conversation Management', () => {
    it('creates new conversation when button is clicked', () => {
      const mockCreateNewConversation = jest.fn();
      mockUseChatApi.mockReturnValue({
        messages: [
          {
            role: 'user' as const,
            content: 'Existing message',
            createdAt: new Date(),
          },
        ],
        conversations: [],
        currentConversationId: 'conv-1',
        isLoading: false,
        error: null,
        sendMessage: jest.fn(),
        loadConversation: jest.fn(),
        createNewConversation: mockCreateNewConversation,
        clearError: jest.fn(),
      });

      render(<AiAssistantPage />);

      const newChatButton = screen.getByRole('button', { name: /new chat/i });
      fireEvent.click(newChatButton);

      expect(mockCreateNewConversation).toHaveBeenCalled();
    });

    it('shows current conversation ID when available', () => {
      mockUseChatApi.mockReturnValue({
        messages: [],
        conversations: [],
        currentConversationId: 'conv-123456789',
        isLoading: false,
        error: null,
        sendMessage: jest.fn(),
        loadConversation: jest.fn(),
        createNewConversation: jest.fn(),
        clearError: jest.fn(),
      });

      render(<AiAssistantPage />);

      expect(screen.getByText((content, element) => {
        return element?.textContent === 'ID: 23456789';
      })).toBeInTheDocument();
    });
  });
});