// Setup testing-library/jest-dom custom matchers
import '@testing-library/jest-dom';

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