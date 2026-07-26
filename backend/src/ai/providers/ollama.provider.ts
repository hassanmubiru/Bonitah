import { Injectable, Logger } from '@nestjs/common';
import { OllamaClient } from './ollama.client';
import type { 
  AIProvider, 
  ChatCompletionOptions, 
  ChatCompletionResponse 
} from './ai-provider.interface';

/**
 * Ollama provider implementation for BFN AI assistant.
 * 
 * Provides access to local Ollama models for financial guidance
 * with complete privacy and zero API costs.
 */
@Injectable()
export class OllamaProvider implements AIProvider {
  private readonly logger = new Logger(OllamaProvider.name);
  private ollama: OllamaClient | null = null;

  readonly name = 'Ollama';

  constructor(
    private readonly baseUrl: string = 'http://localhost:11434',
    private readonly model: string = 'llama3.1:8b',
  ) {
    this.ollama = new OllamaClient(this.baseUrl, this.model);
  }

  isAvailable(): boolean {
    return this.ollama !== null;
  }

  async validateCredentials(): Promise<boolean> {
    if (!this.ollama) {
      return false;
    }

    return await this.ollama.validateAvailability();
  }

  async createChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    if (!this.ollama) {
      throw new Error('Ollama client not initialized');
    }

    try {
      const response = await this.ollama.createChatCompletion({
        messages: options.messages,
        max_tokens: options.maxTokens || 500,
        temperature: options.temperature || 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from Ollama');
      }

      return {
        content,
        model: this.model,
        // Ollama doesn't provide token usage info, so we estimate
        tokensUsed: Math.ceil(content.length / 4), // Rough estimate: ~4 chars per token
      };
    } catch (error) {
      this.logger.error('Ollama chat completion failed', error);
      throw error;
    }
  }

  getRecommendedModel(): string {
    return this.model;
  }

  /**
   * Get information about the Ollama setup.
   */
  async getModelInfo(): Promise<{
    baseUrl: string;
    model: string;
    availableModels: string[];
    isRunning: boolean;
  }> {
    const availableModels = this.ollama ? await this.ollama.getAvailableModels() : [];
    const isRunning = await this.validateCredentials();

    return {
      baseUrl: this.baseUrl,
      model: this.model,
      availableModels,
      isRunning,
    };
  }
}