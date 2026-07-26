import { Injectable, Logger } from '@nestjs/common';
import { DeepSeekClient } from './deepseek.client';
import type {
  AIProvider,
  ChatCompletionOptions,
  ChatCompletionResponse,
} from './ai-provider.interface';

/**
 * DeepSeek provider implementation for BFN AI assistant.
 *
 * Provides access to DeepSeek's API for financial guidance with
 * the same interface as other AI providers.
 */
@Injectable()
export class DeepSeekProvider implements AIProvider {
  private readonly logger = new Logger(DeepSeekProvider.name);
  private deepseek: DeepSeekClient | null = null;

  readonly name = 'DeepSeek';

  constructor(
    private readonly apiKey?: string,
    private readonly baseUrl: string = 'https://api.deepseek.com',
  ) {
    if (this.apiKey) {
      this.deepseek = new DeepSeekClient(this.apiKey, this.baseUrl);
    }
  }

  isAvailable(): boolean {
    return this.deepseek !== null;
  }

  async validateCredentials(): Promise<boolean> {
    if (!this.deepseek) {
      return false;
    }

    return await this.deepseek.validateApiKey();
  }

  async createChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    if (!this.deepseek) {
      throw new Error('DeepSeek client not initialized');
    }

    try {
      const response = await this.deepseek.createChatCompletion({
        model: this.getRecommendedModel(),
        messages: options.messages,
        max_tokens: options.maxTokens || 500,
        temperature: options.temperature || 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from DeepSeek');
      }

      return {
        content,
        model: this.getRecommendedModel(),
      };
    } catch (error) {
      this.logger.error('DeepSeek chat completion failed', error);
      throw error;
    }
  }

  getRecommendedModel(): string {
    return 'deepseek-chat'; // DeepSeek's main chat model
  }
}
