import { Logger } from '@nestjs/common';

/**
 * DeepSeek API client for BFN AI assistant.
 *
 * Provides a simple interface to DeepSeek's chat completions API
 * compatible with OpenAI's message format.
 */
export class DeepSeekClient {
  private readonly logger = new Logger(DeepSeekClient.name);

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = 'https://api.deepseek.com',
  ) {}

  /**
   * Create a chat completion using DeepSeek API.
   *
   * @param options - Chat completion options
   * @returns Promise resolving to the chat completion response
   */
  async createChatCompletion(options: {
    model: string;
    messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }>;
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
  }): Promise<{
    choices: Array<{
      message?: {
        content?: string;
      };
    }>;
  }> {
    const url = `${this.baseUrl}/v1/chat/completions`;

    const requestBody = {
      model: options.model || 'deepseek-chat',
      messages: options.messages,
      max_tokens: options.max_tokens || 500,
      temperature: options.temperature || 0.7,
      stream: options.stream || false,
    };

    this.logger.debug(`Making DeepSeek API request to ${url}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `DeepSeek API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const data = await response.json();

      this.logger.debug(`DeepSeek API response received`);

      return data;
    } catch (error) {
      this.logger.error(`DeepSeek API request failed`, error);
      throw error;
    }
  }

  /**
   * Test if the DeepSeek API key is valid.
   *
   * @returns Promise resolving to true if valid, false otherwise
   */
  async validateApiKey(): Promise<boolean> {
    try {
      const response = await this.createChatCompletion({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
      });

      return response.choices && response.choices.length > 0;
    } catch (error) {
      this.logger.warn('DeepSeek API key validation failed', error);
      return false;
    }
  }
}
