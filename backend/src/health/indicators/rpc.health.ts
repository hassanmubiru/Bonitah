import { Injectable } from '@nestjs/common';
import { HealthIndicator, type HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';

import { EnvService } from '../../config/env.service';

/**
 * Readiness indicator for the Base Sepolia JSON-RPC endpoint (Req 1.1, 16.2).
 *
 * Issues an `eth_chainId` call against the configured RPC URL and asserts the
 * returned chain id matches the expected Base Sepolia id. This is a genuine
 * end-to-end reachability + correctness check; it does not fabricate a result.
 */
@Injectable()
export class RpcHealthIndicator extends HealthIndicator {
  private static readonly KEY = 'rpc';
  private static readonly TIMEOUT_MS = 5000;

  constructor(private readonly env: EnvService) {
    super();
  }

  async isHealthy(): Promise<HealthIndicatorResult> {
    const expectedChainId = this.env.chainId;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RpcHealthIndicator.TIMEOUT_MS);

    try {
      const response = await fetch(this.env.baseSepoliaRpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`RPC responded with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as { result?: string };
      const chainId =
        typeof payload.result === 'string' ? Number.parseInt(payload.result, 16) : Number.NaN;
      const healthy = chainId === expectedChainId;

      const result = this.getStatus(RpcHealthIndicator.KEY, healthy, {
        expectedChainId,
        observedChainId: Number.isNaN(chainId) ? null : chainId,
      });

      if (!healthy) {
        throw new HealthCheckError('RPC chain id mismatch', result);
      }
      return result;
    } catch (error) {
      if (error instanceof HealthCheckError) {
        throw error;
      }
      const reason = error instanceof Error ? error.message : 'unknown RPC error';
      throw new HealthCheckError(
        'Base Sepolia RPC is unreachable',
        this.getStatus(RpcHealthIndicator.KEY, false, { expectedChainId, reason }),
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
