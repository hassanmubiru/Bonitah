import { Injectable, Logger } from '@nestjs/common';
import { OpenAI } from 'openai';
import type {
  AIProvider,
  ChatCompletionOptions,
  ChatCompletionResponse,
} from './ai-provider.interface';

/**
 * OpenAI provider implementation for BFN AI assistant.
 *
 * Wraps OpenAI API in the common AIProvider interface.
 */
@Injectable()
export class OpenAIProvider implements AIProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  private openai: OpenAI | null = null;

  readonly name = 'OpenAI';

  constructor(private readonly apiKey?: string) {
    if (this.apiKey) {
      this.openai = new OpenAI({
        apiKey: this.apiKey,
      });
    }
  }

  isAvailable(): boolean {
    return this.openai !== null;
  }

  async validateCredentials(): Promise<boolean> {
    if (!this.openai) {
      return false;
    }

    try {
      // Test with a minimal request
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      });

      return response.choices && response.choices.length > 0;
    } catch (error) {
      this.logger.warn('OpenAI credentials validation failed', error);
      return false;
    }
  }

  async createChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: this.getRecommendedModel(),
        messages: options.messages,
        max_tokens: options.maxTokens || 500,
        temperature: options.temperature || 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      return {
        content,
        tokensUsed: response.usage?.total_tokens,
        model: response.model,
      };
    } catch (error) {
      this.logger.error('OpenAI chat completion failed', error);
      throw error;
    }
  }

  getRecommendedModel(): string {
    return 'gpt-3.5-turbo'; // Good balance of performance and cost for financial guidance
  }
}
