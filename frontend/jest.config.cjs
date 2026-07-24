const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/**/*.d.ts', '!src/app/globals.css'],
  testMatch: ['**/__tests__/**/*.{js,jsx,ts,tsx}', '**/*(*.)@(spec|test).{js,jsx,ts,tsx}'],
  transformIgnorePatterns: [
    'node_modules/(?!(wagmi|@wagmi|@rainbow-me|viem|@tanstack|siwe)/)',
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);