import { Injectable, Logger } from '@nestjs/common';
import { EnvService } from '../../config/env.service';
import { OpenAIProvider } from './openai.provider';
import { DeepSeekProvider } from './deepseek.provider';
import type { AIProvider, AIProviderType } from './ai-provider.interface';

/**
 * Factory for creating and managing AI providers.
 * 
 * Handles provider selection based on configuration and availability:
 * - 'openai': Use OpenAI exclusively
 * - 'deepseek': Use DeepSeek exclusively  
 * - 'auto': Use DeepSeek if available, fallback to OpenAI
 */
@Injectable()
export class AIProviderFactory {
  private readonly logger = new Logger(AIProviderFactory.name);
  private cachedProvider: AIProvider | null = null;

  constructor(private readonly env: EnvService) {}

  /**
   * Get the configured AI provider.
   * 
   * @returns Promise resolving to available AI provider
   * @throws Error if no providers are available or configured
   */
  async getProvider(): Promise<AIProvider> {
    // Return cached provider if available
    if (this.cachedProvider) {
      return this.cachedProvider;
    }

    const providerType = this.env.aiProvider as AIProviderType;
    this.logger.log(`Initializing AI provider: ${providerType}`);

    let provider: AIProvider | null = null;

    switch (providerType) {
      case 'openai':
        provider = await this.createOpenAIProvider();
        break;
        
      case 'deepseek':
        provider = await this.createDeepSeekProvider();
        break;
        
      case 'auto':
        // Try DeepSeek first, fallback to OpenAI
        provider = await this.createDeepSeekProvider();
        if (!provider) {
          provider = await this.createOpenAIProvider();
        }
        break;
        
      default:
        throw new Error(`Unknown AI provider type: ${providerType}`);
    }

    if (!provider) {
      throw new Error('No AI providers are available. Please configure OPENAI_API_KEY or DEEPSEEK_API_KEY.');
    }

    // Validate the provider
    const isValid = await provider.validateCredentials();
    if (!isValid) {
      throw new Error(`AI provider ${provider.name} credentials are invalid`);
    }

    this.logger.log(`AI provider initialized: ${provider.name}`);
    this.cachedProvider = provider;
    return provider;
  }

  /**
   * Create OpenAI provider if configured.
   */
  private async createOpenAIProvider(): Promise<AIProvider | null> {
    const apiKey = this.env.openaiApiKey;
    if (!apiKey) {
      this.logger.debug('OpenAI API key not configured');
      return null;
    }

    const provider = new OpenAIProvider(apiKey);
    if (!provider.isAvailable()) {
      this.logger.warn('OpenAI provider not available');
      return null;
    }

    return provider;
  }

  /**
   * Create DeepSeek provider if configured.
   */
  private async createDeepSeekProvider(): Promise<AIProvider | null> {
    const apiKey = this.env.deepseekApiKey;
    if (!apiKey) {
      this.logger.debug('DeepSeek API key not configured');
      return null;
    }

    const provider = new DeepSeekProvider(apiKey, this.env.deepseekBaseUrl);
    if (!provider.isAvailable()) {
      this.logger.warn('DeepSeek provider not available');
      return null;
    }

    return provider;
  }

  /**
   * Clear cached provider (for testing or reconfiguration).
   */
  clearCache(): void {
    this.cachedProvider = null;
  }

  /**
   * Get information about available providers.
   */
  async getProviderInfo(): Promise<{
    selected: string;
    available: string[];
    configured: string[];
  }> {
    const available: string[] = [];
    const configured: string[] = [];

    // Check OpenAI
    if (this.env.openaiApiKey) {
      configured.push('OpenAI');
      const openaiProvider = await this.createOpenAIProvider();
      if (openaiProvider && await openaiProvider.validateCredentials()) {
        available.push('OpenAI');
      }
    }

    // Check DeepSeek
    if (this.env.deepseekApiKey) {
      configured.push('DeepSeek');
      const deepseekProvider = await this.createDeepSeekProvider();
      if (deepseekProvider && await deepseekProvider.validateCredentials()) {
        available.push('DeepSeek');
      }
    }

    let selected = 'None';
    try {
      const provider = await this.getProvider();
      selected = provider.name;
    } catch (error) {
      // Provider not available
    }

    return {
      selected,
      available,
      configured,
    };
  }
}