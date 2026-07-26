/**
 * Common interface for AI providers (OpenAI, DeepSeek, etc.)
 *
 * Provides a standardized way to interact with different AI services
 * while maintaining the same functionality and constraints.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface ChatCompletionResponse {
  content: string;
  tokensUsed?: number | undefined;
  model?: string;
}

export interface AIProvider {
  /** Provider name for logging and identification */
  readonly name: string;

  /** Test if the provider is available and configured */
  isAvailable(): boolean;

  /** Validate API credentials */
  validateCredentials(): Promise<boolean>;

  /** Generate chat completion */
  createChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse>;

  /** Get recommended model for financial guidance */
  getRecommendedModel(): string;
}

export type AIProviderType = 'openai' | 'deepseek' | 'ollama' | 'auto';
