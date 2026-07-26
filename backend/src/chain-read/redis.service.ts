import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';

import { EnvService } from '../config/env.service';

/**
 * Redis service for the ChainRead module (Req 1.4, 1.5).
 *
 * Provides a connection-managed Redis client for caching financial values
 * with provenance metadata. Entries have a 30-second TTL to enforce
 * staleness requirements.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType | null = null;

  constructor(private readonly env: EnvService) {}

  async onModuleInit(): Promise<void> {
    this.client = createClient({
      url: this.env.redisUrl,
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis connection error', error);
    });

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }

  /**
   * Get a cached value by key.
   * Returns null if the key doesn't exist or has expired.
   */
  async get(key: string): Promise<string | null> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    const result = await this.client.get(key);
    return result;
  }

  /**
   * Set a cached value with 30-second TTL (Req 1.4, 1.5).
   */
  async set(key: string, value: string): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    // 30-second TTL to enforce staleness policy (Req 1.4, 1.5)
    await this.client.setEx(key, 30, value);
  }

  /**
   * Delete a cached value by key.
   */
  async del(key: string): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    await this.client.del(key);
  }

  /**
   * Check if Redis is connected and available.
   */
  isConnected(): boolean {
    return this.client?.isOpen ?? false;
  }
}
