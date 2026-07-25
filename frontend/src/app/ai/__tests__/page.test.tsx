/**
 * Component tests for AI Assistant page
 * 
 * Tests cover:
 * - Data-source wiring to chat API
 * - Loading/error/retry rendering for AI responses
 * - Chat functionality and conversation management
 * - Action button integration requiring wallet signing
 * 
 * Validates Requirements: 11.1, 11.4, 15.5
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';

import AiAssistantPage from '../page';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useChatApi } from '@/hooks/useChatApi';

// Mock auth guard
jest.mock('@/hooks/useAuthGuard', () => ({
  useAuthGuard: jest.fn(),
}));

// Mock chat API hook
jest.mock('@/hooks/useChatApi', () => ({
  useChatApi: jest.fn(),
}));

// Mock action button component
jest.mock('@/components/ai/ActionButton', () => ({
  ActionButtons: ({ actions, onExecuteAction }: any) => (
    <div data-testid="action-buttons">
      {actions.map((action: any, index: number) => (
        <button
          key={index}
          onClick={() => onExecuteAction(action)}
          data-testid={`action-${action.type}`}
        >
          {action.label}
        </button>
      ))}
    </div>
  ),
}));

const mockUseAuthGuard = useAuthGuard as jest.MockedFunction<typeof useAuthGuard>;
const mockUseChatApi = useChatApi as jest.MockedFunction<typeof useChatApi>;

// Mock window.location for navigation tests
delete (window as any).location;
window.location = { href: '' } as any;

describe('AiAssistantPage Component Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockUseAuthGuard.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { 
        id: '1', 
        walletAddress: '0x1234567890123456789012345678901234567890',
        role: 'USER' as const,
      },
    });

    mockUseChatApi.mockReturnValue({
      messages: [],
      isLoading: false,
      error: null,
      sendMessage: jest.fn(),
      conversations: [],
      currentConversationId: 'conv-1',
      createNewConversation: jest.fn(),
      loadConversation: jest.fn(),
      clearError: jest.fn(),
    });
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    );
  };

  describe('Authentication Guards', () => {
    it('shows loading state during authentication check', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        user: null,
      });

      renderWithProviders(<AiAssistantPage />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
      expect(screen.queryByText(/ai financial assistant/i)).not.toBeInTheDocument();
    });

    it('returns null when not authenticated (auth guard redirects)', () => {
      mockUseAuthGuard.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      });

      const { container } = renderWithProviders(<AiAssistantPage />);

      expect(container.firstChild).toBeNull();
    });

    it('renders chat interface when authenticated', () => {
      renderWithProviders(<AiAssistantPage />);

      expect(screen.getByText(/ai financial assistant/i)).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });

  describe('Data Source Wiring - Chat API', () => {
    it('uses chat API hook to manage conversation state', () => {
      renderWithProviders(<AiAssistantPage />);

      expect(mockUseChatApi).toHaveBeenCalled();
    });

    it('displays conversation history from chat API', () => {
      const mockConversations = [
        {
          id: 'conv-1',
          lastMessage: 'What is my portfolio balance?',
          lastMessageAt: '2024-01-01T12:00:00Z',
          messageCount: 5,
        },
        {
          id: 'conv-2', 
          lastMessage: 'How should I invest?',
          lastMessageAt: '2024-01-02T12:00:00Z',
          messageCount: 3,
        },
      ];

      mockUseChatApi.mockReturnValue({
        ...mockUseChatApi(),
        conversations: mockConversations,
      });

      renderWithProviders(<AiAssistantPage />);

      expect(screen.getByText('What is my portfolio balance?')).toBeInTheDocument();
      expect(screen.getByText('How should I invest?')).toBeInTheDocument();
      expect(screen.getByText('5 messages')).toBeInTheDocument();
      expect(screen.getByText('3 messages')).toBeInTheDocument();
    });

    it('displays chat messages from API data', () => {
      const mockMessages = [
        {
          id: '1',
          role: 'user' as const,
          content: 'What is my current balance?',
          createdAt: '2024-01-01T12:00:00Z',
        },
        {
          id: '2',
          role: 'assistant' as const,
          content: 'Your current balance is 1.5 ETH in savings.',
          createdAt: '2024-01-01T12:01:00Z',
          actions: [
            { type: 'view_portfolio', label: 'View Portfolio' },
          ],
        },
      ];

      mockUseChatApi.mockReturnValue({
        ...mockUseChatApi(),
        messages: mockMessages,
      });

      renderWithProviders(<AiAssistantPage />);

      expect(screen.getByText('What is my current balance?')).toBeInTheDocument();
      expect(screen.getByText('Your current balance is 1.5 ETH in savings.')).toBeInTheDocument();
    });

    it('displays empty conversation state when no messages', () => {
      renderWithProviders(<AiAssistantPage />);

      expect(screen.getByText(/welcome to your ai financial assistant/i)).toBeInTheDocument();
      expect(screen.getByText(/ask questions about your portfolio/i)).toBeInTheDocument();
    });
  });

  describe('Loading States - Requirement 11.4', () => {
    it('displays typing indicator when AI is responding', () => {
      mockUseChatApi.mockReturnValue({
        ...mockUseChatApi(),
        isLoading: true,
      });

      renderWithProviders(<AiAssistantPage />);

      expect(screen.getByText(/ai is thinking/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();
    });

    it('disables input during loading', () => {
      mockUseChatApi.mockReturnValue({
        ...mockUseChatApi(),
        isLoading: true,
      });

      renderWithProviders(<AiAssistantPage />);

      const chatInput = screen.getByRole('textbox', { name: /chat input/i });
      expect(chatInput).toBeDisabled();
    });

    it('shows loading spinner in send button during message sending', () => {
      mockUseChatApi.mockReturnValue({
        ...mockUseChatApi(),
        isLoading: true,
      });

      renderWithProviders(<AiAssistantPage />);

      // Send button should show loading spinner
      const sendButton = screen.getByRole('button', { name: /send message/i });
      expect(sendButton).toBeInTheDocument();
      expect(sendButton).toBeDisabled();
    });
  });

  describe('Error States and Retry Functionality', () => {
    const mockClearError = jest.fn();

    beforeEach(() => {
      mockUseChatApi.mockReturnValue({
        ...mockUseChatApi(),
        error: 'Failed to send message to AI assistant',
        clearError: mockClearError,
      });
    });

    it('displays error alert when chat API fails', () => {
      renderWithProviders(<AiAssistantPage />);

      expect(screen.getByText(/failed to send message to ai assistant/i)).toBeInTheDocument();
    });

    it('provides retry functionality through clear error button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AiAssistantPage />);

      const retryButton = screen.getByRole('button', { name: /clear error and retry/i });
      expect(retryButton).toBeInTheDocument();

      await user.click(retryButton);

      expect(mockClearError).toHaveBeenCalled();
    });

    it('hides error alert after clearing error', () => {
      const { rerender } = renderWithProviders(<AiAssistantPage />);

      expect(screen.getByText(/failed to send message/i)).toBeInTheDocument();

      // Clear error
      mockUseChatApi.mockReturnValue({
        ...mockUseChatApi(),
        error: null,
      });

      rerender(
        <QueryClientProvider client={queryClient}>
          <AiAssistantPage />
        </QueryClientProvider>
      );

      expect(screen.queryByText(/failed to send message/i)).not.toBeInTheDocument();
    });
  });

  describe('Message Sending Functionality', () => {
    const mockSendMessage = jest.fn();

    beforeEach(() => {
      mockUseChatApi.mockReturnValue({
        ...mockUseChatApi(),
        sendMessage: mockSendMessage,
      });
    });

    it('calls sendMessage when form is submitted', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AiAssistantPage />);

      const chatInput = screen.getByRole('textbox', { name: /chat input/i });
      const sendButton = screen.getByRole('button', { name: /send message/i });

      await user.type(chatInput, 'What is my portfolio balance?');
      await user.click(sendButton);

      expect(mockSendMessage).toHaveBeenCalledWith('What is my portfolio balance?');
    });

    it('sends message on Enter key press', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AiAssistantPage />);

      const chatInput = screen.getByRole('textbox', { name: /chat input/i });

      await user.type(chatInput, 'How can I save more?');
      await user.keyboard('{Enter}');

      expect(mockSendMessage).toHaveBeenCalledWith('How can I save more?');
    });

    it('does not send empty messages', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AiAssistantPage />);

      const sendButton = screen.getByRole('button', { name: /send message/i });

      await user.click(sendButton);

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('enforces 2000 character limit', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AiAssistantPage />);

      const chatInput = screen.getByRole('textbox', { name: /chat input/i });
      expect(chatInput).toHaveAttribute('maxLength', '2000');

      // Character counter should be shown
      expect(screen.getByText('0/2000 characters')).toBeInTheDocument();

      await user.type(chatInput, 'Test message');
      expect(screen.getByText('12/2000 characters')).toBeInTheDocument();
    });
  });

  describe('Action Button Integration - Wallet Signing', () => {
    const mockMessages = [
      {
        id: '2',
        role: 'assistant' as const,
        content: 'You should consider depositing more into savings.',
        createdAt: '2024-01-01T12:01:00Z',
        actions: [
          { type: 'view_portfolio', label: 'View Portfolio' },
          { type: 'deposit_savings', label: 'Deposit Savings' },
          { type: 'create_goal', label: 'Create Goal' },
        ],
      },
    ];

    beforeEach(() => {
      mockUseChatApi.mockReturnValue({
        ...mockUseChatApi(),
        messages: mockMessages,
      });
    });

    it('displays action buttons for AI messages with actions', () => {
      renderWithProviders(<AiAssistantPage />);

      expect(screen.getByTestId('action-buttons')).toBeInTheDocument();
      expect(screen.getByTestId('action-view_portfolio')).toBeInTheDocument();
      expect(screen.getByTestId('action-deposit_savings')).toBeInTheDocument();
      expect(screen.getByTestId('action-create_goal')).toBeInTheDocument();
    });

    it('navigates to correct pages when actions are executed', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AiAssistantPage />);

      // Test view portfolio action
      await user.click(screen.getByTestId('action-view_portfolio'));
      expect(window.location.href).toBe('/dashboard');

      // Test deposit savings action  
      await user.click(screen.getByTestId('action-deposit_savings'));
      expect(window.location.href).toBe('/savings');

      // Test create goal action
      await user.click(screen.getByTestId('action-create_goal'));
      expect(window.location.href).toBe('/savings#goals');
    });

    it('handles unknown action types gracefully', async () => {
      const user = userEvent.setup();
      
      const mockMessagesWithUnknownAction = [
        {
          id: '2',
          role: 'assistant' as const,
          content: 'Test message',
          createdAt: '2024-01-01T12:01:00Z',
          actions: [
            { type: 'unknown_action', label: 'Unknown Action' },
          ],
        },
      ];

      mockUseChatApi.mockReturnValue({
        ...mockUseChatApi(),
        messages: mockMessagesWithUnknownAction,
      });

      // Mock console.warn to test error handling
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      renderWithProviders(<AiAssistantPage />);

      await user.click(screen.getByTestId('action-unknown_action'));

      expect(consoleSpy).toHaveBeenCalledWith('Unknown action type:', 'unknown_action');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Conversation Management', () => {
    const mockCreateNewConversation = jest.fn();
    const mockLoadConversation = jest.fn();

    beforeEach(() => {
      mockUseChatApi.mockReturnValue({
        ...mockUseChatApi(),
        createNewConversation: mockCreateNewConversation,
        loadConversation: mockLoadConversation,
        conversations: [
          {
            id: 'conv-1',
            lastMessage: 'Previous conversation',
            lastMessageAt: '2024-01-01T12:00:00Z',
            messageCount: 3,
          },
        ],
      });
    });

    it('creates new conversation when new chat button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AiAssistantPage />);

      const newChatButton = screen.getByRole('button', { name: /new chat/i });
      await user.click(newChatButton);

      expect(mockCreateNewConversation).toHaveBeenCalled();
    });

    it('loads conversation when conversation item is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AiAssistantPage />);

      const conversationButton = screen.getByText('Previous conversation');
      await user.click(conversationButton);

      expect(mockLoadConversation).toHaveBeenCalledWith('conv-1');
    });

    it('shows empty state when no conversations exist', () => {
      mockUseChatApi.mockReturnValue({
        ...mockUseChatApi(),
        conversations: [],
      });

      renderWithProviders(<AiAssistantPage />);

      expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility and UX', () => {
    it('provides proper ARIA labels and roles', () => {
      renderWithProviders(<AiAssistantPage />);

      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByLabelText(/chat input/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/send message/i)).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AiAssistantPage />);

      const chatInput = screen.getByRole('textbox', { name: /chat input/i });
      
      await user.tab();
      expect(chatInput).toHaveFocus();
    });

    it('displays message timestamps', () => {
      const mockMessages = [
        {
          id: '1',
          role: 'user' as const,
          content: 'Test message',
          createdAt: '2024-01-01T12:00:00Z',
        },
      ];

      mockUseChatApi.mockReturnValue({
        ...mockUseChatApi(),
        messages: mockMessages,
      });

      renderWithProviders(<AiAssistantPage />);

      // Should display localized timestamp
      expect(screen.getByText(/12:00/)).toBeInTheDocument();
    });
  });
});