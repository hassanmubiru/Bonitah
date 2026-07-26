/**
 * AI Hook
 *
 * Hook for interacting with AI assistant functionality
 * Provides chat capabilities and AI-powered insights
 */

import { useState, useCallback } from 'react';

export interface AIResponse {
  message: string;
  timestamp: Date;
  id: string;
}

export interface AIState {
  messages: AIResponse[];
  isLoading: boolean;
  error?: Error | null;
}

/**
 * Hook for AI chat functionality
 */
export function useAI() {
  const [state, setState] = useState<AIState>({
    messages: [],
    isLoading: false,
    error: null,
  });

  const sendMessage = useCallback(async (message: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Mock AI response
      const response: AIResponse = {
        message: `AI response to: ${message}`,
        timestamp: new Date(),
        id: Math.random().toString(36).substring(7),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, response],
        isLoading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error as Error,
      }));
    }
  }, []);

  const clearMessages = useCallback(() => {
    setState((prev) => ({ ...prev, messages: [] }));
  }, []);

  return {
    ...state,
    sendMessage,
    clearMessages,
  };
}
