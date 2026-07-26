// Setup testing-library/jest-dom custom matchers
require('@testing-library/jest-dom');

// Polyfills for viem and crypto operations
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock crypto for viem
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => '00000000-0000-0000-0000-000000000000',
    getRandomValues: (buffer) => {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = Math.floor(Math.random() * 256);
      }
      return buffer;
    },
    subtle: {
      digest: () => Promise.resolve(new ArrayBuffer(32)),
    },
  },
});

// Mock wagmi ESM modules
jest.mock('wagmi', () => ({
  useAccount: jest.fn(() => ({
    isConnected: false,
    address: undefined,
    chainId: undefined,
  })),
  useConnect: jest.fn(() => ({
    connect: jest.fn(),
    connectors: [],
    status: 'idle',
  })),
  useDisconnect: jest.fn(() => ({
    disconnect: jest.fn(),
  })),
  useChainId: jest.fn(() => 84532),
  useSwitchChain: jest.fn(() => ({
    switchChain: jest.fn(),
  })),
  useReadContract: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
  useWriteContract: jest.fn(() => ({
    writeContract: jest.fn(),
    isPending: false,
    error: null,
  })),
  useWaitForTransactionReceipt: jest.fn(() => ({
    isLoading: false,
    isSuccess: false,
    error: null,
  })),
  useBalance: jest.fn(() => ({
    data: { formatted: '0', symbol: 'ETH' },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
  createConfig: jest.fn(),
  http: jest.fn(),
}));

// Mock viem
jest.mock('viem', () => ({
  isAddress: jest.fn((address) => {
    if (typeof address !== 'string') return false;
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }),
  getAddress: jest.fn((address) => {
    if (typeof address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new Error(
        `Address "${address}" is invalid.\n- Address must be a hex value of 20 bytes (40 hex characters).\n- Address must match its checksum counterpart.\nVersion: viem@2.55.5`,
      );
    }
    return address;
  }),
  createPublicClient: jest.fn(() => ({
    readContract: jest.fn(),
    multicall: jest.fn(),
  })),
  parseEther: jest.fn((value) => BigInt(Number(value) * 1e18)),
  formatEther: jest.fn((value) => (Number(value) / 1e18).toString()),
  encodeFunctionData: jest.fn(() => '0x'),
  decodeFunctionResult: jest.fn(() => ({})),
}));

// Mock @rainbow-me/rainbowkit
jest.mock('@rainbow-me/rainbowkit', () => ({
  RainbowKitProvider: ({ children }) => children,
  ConnectButton: () => null,
  getDefaultWallets: jest.fn(() => ({
    connectors: [],
    wallets: [],
  })),
  getDefaultConfig: jest.fn(() => ({})),
}));

// Mock next-themes
jest.mock('next-themes', () => ({
  useTheme: jest.fn(() => ({
    theme: 'light',
    setTheme: jest.fn(),
    resolvedTheme: 'light',
  })),
  ThemeProvider: ({ children }) => children,
}));

// Global test utilities
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

global.matchMedia = jest.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

// Mock CSS modules
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'CSS', {
    value: {
      supports: jest.fn().mockReturnValue(false),
    },
  });
}

// Mock localStorage with proper error handling
const localStorageMock = {
  getItem: jest.fn((key) => {
    // Return some default values for common keys
    if (key === 'theme') return 'light';
    if (key === 'settings') return JSON.stringify({});
    return null;
  }),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
if (typeof global !== 'undefined') {
  global.localStorage = localStorageMock;
}

// Mock fetch
if (typeof global !== 'undefined') {
  global.fetch = jest.fn();
}

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock process.env for Next.js
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID = 'test-project-id';
