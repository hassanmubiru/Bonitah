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

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
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