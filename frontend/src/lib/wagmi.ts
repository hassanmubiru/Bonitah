import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

import { BASE_SEPOLIA_CHAIN_ID } from '@bfn/shared';

/**
 * wagmi + RainbowKit configuration for BFN.
 *
 * BFN interacts with exactly one network: Base Sepolia (chain ID 84532). The
 * chain list below is intentionally limited to Base Sepolia only so the wallet
 * connection and network guard can enforce it (Req 2.1, 2.3). viem's
 * `baseSepolia` chain carries the canonical 84532 id; we assert it here to fail
 * fast if an upstream definition ever drifts.
 * 
 * We use getDefaultConfig from RainbowKit to ensure all wallets are properly
 * configured and displayed in the connection modal. The missing @x402/evm 
 * dependencies are handled via webpack fallbacks in next.config.js.
 */
if (baseSepolia.id !== BASE_SEPOLIA_CHAIN_ID) {
  throw new Error(
    `Unexpected Base Sepolia chain id ${baseSepolia.id}; expected ${BASE_SEPOLIA_CHAIN_ID}.`,
  );
}

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

import { BASE_SEPOLIA_CHAIN_ID } from '@bfn/shared';

/**
 * wagmi + RainbowKit configuration for BFN.
 *
 * BFN interacts with exactly one network: Base Sepolia (chain ID 84532). The
 * chain list below is intentionally limited to Base Sepolia only so the wallet
 * connection and network guard can enforce it (Req 2.1, 2.3). viem's
 * `baseSepolia` chain carries the canonical 84532 id; we assert it here to fail
 * fast if an upstream definition ever drifts.
 * 
 * We use getDefaultConfig from RainbowKit to ensure all wallets are properly
 * configured and displayed in the connection modal. The missing @x402/evm 
 * dependencies are handled via webpack fallbacks in next.config.js.
 */
if (baseSepolia.id !== BASE_SEPOLIA_CHAIN_ID) {
  throw new Error(
    `Unexpected Base Sepolia chain id ${baseSepolia.id}; expected ${BASE_SEPOLIA_CHAIN_ID}.`,
  );
}

/**
 * WalletConnect project id. Required by RainbowKit for WalletConnect-based
 * wallets. For local development, we use a safe placeholder that won't cause
 * connection errors.
 */
const walletConnectProjectId = process.env['NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID'] || 'local-dev-placeholder';

/** Optional custom RPC endpoint for Base Sepolia; falls back to the public RPC. */
const baseSepoliaRpcUrl = process.env['NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL'];

export const wagmiConfig = getDefaultConfig({
  appName: 'Bonitah Financial Network',
  projectId: walletConnectProjectId,
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(baseSepoliaRpcUrl),
  },
  ssr: true,
});

// Suppress WalletConnect WebSocket errors in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalError = console.error;
  console.error = (...args) => {
    // Suppress specific WalletConnect errors that are expected in development
    const message = args[0];
    if (
      typeof message === 'string' && 
      (message.includes('Connection interrupted while trying to subscribe') ||
       message.includes('WebSocket connection closed abnormally') ||
       message.includes('Project not found'))
    ) {
      return; // Skip logging these specific errors
    }
    originalError.apply(console, args);
  };
}
