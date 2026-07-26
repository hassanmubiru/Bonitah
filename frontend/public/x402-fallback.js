/**
 * Fallback module for missing @x402/* dependencies.
 *
 * The @x402/* packages are optional dependencies that Coinbase's CDP SDK
 * tries to import for advanced payment functionality. Since BFN doesn't use
 * these features, we provide empty fallbacks to prevent build errors.
 */

// Export empty objects and functions to satisfy import requirements
export default {};

// Common exports that might be expected
export const x402Client = class {
  constructor() {}
};

export const registerExactEvmScheme = () => {};
export const registerExactSvmScheme = () => {};
export const ExactSvmScheme = {};
export const UptoEvmScheme = {};
export const toClientEvmSigner = () => {};
export const fromCdpSmartWallet = () => {};
export const cdpSolanaAccountToSvmSigner = () => {};

// Mock async storage for React Native dependencies
export const getItem = () => Promise.resolve(null);
export const setItem = () => Promise.resolve();
export const removeItem = () => Promise.resolve();
export const getAllKeys = () => Promise.resolve([]);
export const multiGet = () => Promise.resolve([]);
export const multiSet = () => Promise.resolve();
export const multiRemove = () => Promise.resolve();
export const clear = () => Promise.resolve();
