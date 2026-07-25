'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSiweAuth } from './useSiweAuth';

/**
 * Message structure matching backend API
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  actions?: AIAction[]; // Actions parsed from AI response
}

/**
 * Action types that the AI can recommend
 */
export type ActionType = 
  | 'deposit_savings'
  | 'create_goal' 
  | 'join_circle'
  | 'invest_pool'
  | 'withdraw_funds'
  | 'view_portfolio';

/**
 * Action data from AI recommendations
 */
export interface AIAction {
  type: ActionType;
  title: string;
  description: string;
  amount?: string;
  targetAddress?: string;
  requiresSignature: boolean;
  estimatedGas?: string;
}

/**
 * Conversation summary from backend
 */
export interface ConversationSummary {
  id: string;
  createdAt: Date;
  messageCount: number;
  lastMessage: string | null;
  lastMessageAt: Date;
}

/**
 * Chat API hook state
 */
export interface ChatApiState {
  messages: ChatMessage[];
  conversations: ConversationSummary[];
  currentConversationId: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Custom hook for AI chat API integration.
 * 
 * Implements Task 21.8 requirements:
 * - JWT-authenticated API calls to backend AI service
 * - Real-time conversation management with history persistence
 * - Proper error handling for AI service issues
 * - Loading states with typing indicators
 * - Integration with existing wallet hooks for authentication
 * 
 * Features:
 * - Send messages to `/ai/chat` endpoint with authentication
 * - Load and manage conversation history
 * - Handle API errors with retry functionality
 * - Real-time message state management
 * - Conversation switching and creation
 * - Proper loading states for UX feedback
 */
export function useChatApi() {
  const { isAuthenticated } = useSiweAuth();
  
  const [state, setState] = useState<ChatApiState>({
    messages: [],
    conversations: [],
    currentConversationId: null,
    isLoading: false,
    error: null,
  });

  // Backend API base URL
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001';

  /**
   * Get authorization header with JWT token
   */
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('bfn-auth-token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }, []);

  /**
   * Parse AI response for recommended actions
   */
  const parseActionsFromResponse = useCallback((response: string): AIAction[] => {
    if (!response || typeof response !== 'string') return [];
    
    const actions: AIAction[] = [];
    
    // Simple parsing - in real implementation, AI would return structured data
    // For now, detect common financial action patterns in text
    const lowerResponse = response.toLowerCase();
    
    if (lowerResponse.includes('deposit') && lowerResponse.includes('savings')) {
      actions.push({
        type: 'deposit_savings',
        title: 'Deposit to Savings',
        description: 'Add funds to your savings vault',
        requiresSignature: true,
      });
    }
    
    if (lowerResponse.includes('create') && (lowerResponse.includes('goal') || lowerResponse.includes('target'))) {
      actions.push({
        type: 'create_goal',
        title: 'Create Savings Goal',
        description: 'Set up a new financial goal',
        requiresSignature: true,
      });
    }
    
    if (lowerResponse.includes('join') && (lowerResponse.includes('circle') || lowerResponse.includes('community'))) {
      actions.push({
        type: 'join_circle',
        title: 'Join Savings Circle',
        description: 'Participate in community savings',
        requiresSignature: true,
      });
    }
    
    if (lowerResponse.includes('invest') && lowerResponse.includes('pool')) {
      actions.push({
        type: 'invest_pool',
        title: 'Invest in Pool',
        description: 'Add funds to investment pool',
        requiresSignature: true,
      });
    }
    
    if (lowerResponse.includes('portfolio') || lowerResponse.includes('dashboard')) {
      actions.push({
        type: 'view_portfolio',
        title: 'View Portfolio',
        description: 'Check your current portfolio status',
        requiresSignature: false,
      });
    }
    
    return actions;
  }, []);
  const loadConversations = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await fetch(`${apiUrl}/ai/conversations?limit=20`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to load conversations');
      }

      const data = await response.json();
      setState((prev) => ({
        ...prev,
        conversations: (data.conversations || []).map((conv: any) => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          lastMessageAt: new Date(conv.lastMessageAt),
        })),
      }));
    } catch (error) {
      console.error('Failed to load conversations:', error);
      setState((prev) => ({
        ...prev,
        error: 'Failed to load conversation history',
      }));
    }
  }, [isAuthenticated, apiUrl, getAuthHeaders]);

  /**
   * Load specific conversation messages
   */
  const loadConversation = useCallback(async (conversationId: string) => {
    if (!isAuthenticated) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`${apiUrl}/ai/conversation?id=${conversationId}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to load conversation');
      }

      const data: { conversation: { messages: ChatMessage[] } } = await response.json();
      setState((prev) => ({
        ...prev,
        messages: data.conversation.messages.map((msg) => ({
          ...msg,
          createdAt: new Date(msg.createdAt),
        })),
        currentConversationId: conversationId,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to load conversation:', error);
      setState((prev) => ({
        ...prev,
        error: 'Failed to load conversation',
        isLoading: false,
      }));
    }
  }, [isAuthenticated, apiUrl, getAuthHeaders]);

  /**
   * Send a message to the AI assistant
   */
  const sendMessage = useCallback(async (question: string) => {
    if (!isAuthenticated || !question.trim()) return;

    // Add user message to UI immediately for responsive feel
    const userMessage: ChatMessage = {
      role: 'user',
      content: question.trim(),
      createdAt: new Date(),
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
      error: null,
    }));

    try {
      const response = await fetch(`${apiUrl}/ai/chat`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ question: question.trim() }),
      });

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error('AI assistant is temporarily unavailable. Please try again in a moment.');
        } else if (response.status === 400) {
          const error = await response.json();
          throw new Error(error.message || 'Invalid question format');
        } else {
          throw new Error('Failed to send message');
        }
      }

      const data = await response.json();

      // Add AI response to messages
      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: data.answer,
        createdAt: new Date(),
        actions: parseActionsFromResponse(data.answer),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, aiMessage],
        currentConversationId: data.conversationId,
        isLoading: false,
      }));

      // Refresh conversation list to update message counts
      await loadConversations();
    } catch (error) {
      console.error('Failed to send message:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to send message',
        isLoading: false,
      }));
    }
  }, [isAuthenticated, apiUrl, getAuthHeaders, loadConversations, parseActionsFromResponse]);

  /**
   * Create a new conversation (clear current chat)
   */
  const createNewConversation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messages: [],
      currentConversationId: null,
      error: null,
    }));
  }, []);

  /**
   * Clear current error
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Load conversations on authentication
  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    } else {
      // Clear state when not authenticated
      setState({
        messages: [],
        conversations: [],
        currentConversationId: null,
        isLoading: false,
        error: null,
      });
    }
  }, [isAuthenticated, loadConversations]);

  return {
    ...state,
    sendMessage,
    loadConversation,
    createNewConversation,
    clearError,
    refreshConversations: loadConversations,
  };
}