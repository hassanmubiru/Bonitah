import { Logger } from '@nestjs/common';

/**
 * Ollama API client for BFN AI assistant.
 * 
 * Provides a simple interface to Ollama's chat completions API
 * for local AI model inference.
 */
export class OllamaClient {
  private readonly logger = new Logger(OllamaClient.name);

  constructor(
    private readonly baseUrl: string = 'http://localhost:11434',
    private readonly model: string = 'llama3.1:8b',
  ) {}

  /**
   * Create a chat completion using Ollama API.
   * 
   * @param options - Chat completion options
   * @returns Promise resolving to the chat completion response
   */
  async createChatCompletion(options: {
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
    const url = `${this.baseUrl}/api/chat`;
    
    // Convert OpenAI-style messages to Ollama format
    const requestBody = {
      model: this.model,
      messages: options.messages,
      stream: false, // We'll use non-streaming for simplicity
      options: {
        temperature: options.temperature || 0.7,
        num_predict: options.max_tokens || 500,
      },
    };

    this.logger.debug(`Making Ollama API request to ${url}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      this.logger.debug(`Ollama API response received`);
      
      // Convert Ollama response to OpenAI-compatible format
      return {
        choices: [{
          message: {
            content: data.message?.content || '',
          }
        }]
      };
      
    } catch (error) {
      this.logger.error(`Ollama API request failed`, error);
      throw error;
    }
  }

  /**
   * Test if Ollama is available and the model is accessible.
   * 
   * @returns Promise resolving to true if available, false otherwise
   */
  async validateAvailability(): Promise<boolean> {
    try {
      // First check if Ollama server is running
      const healthResponse = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });

      if (!healthResponse.ok) {
        this.logger.warn('Ollama server not accessible');
        return false;
      }

      // Check if our specific model is available
      const models = await healthResponse.json();
      const modelExists = models.models?.some((model: any) => 
        model.name === this.model || model.name.startsWith(this.model.split(':')[0])
      );

      if (!modelExists) {
        this.logger.warn(`Ollama model ${this.model} not found. Available models:`, 
          models.models?.map((m: any) => m.name) || []
        );
        return false;
      }

      // Test with a simple query
      const testResponse = await this.createChatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      });

      return testResponse.choices && testResponse.choices.length > 0;
    } catch (error) {
      this.logger.warn('Ollama availability check failed', error);
      return false;
    }
  }

  /**
   * Get available models from Ollama.
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        return [];
      }
      
      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch (error) {
      this.logger.warn('Failed to get Ollama models', error);
      return [];
    }
  }
}