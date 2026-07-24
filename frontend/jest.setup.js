// In ES modules, we need to use a different approach for mocking
// This file runs in a Node.js context before tests, so we need to handle imports properly

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
Object.defineProperty(window, 'CSS', {
  value: {
    supports: jest.fn().mockReturnValue(false),
  },
});