/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*(\\.spec|\\.test|\\.e2e-spec)\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  setupFiles: ['<rootDir>/test/jest-env-setup.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.module.ts', '!src/main.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    // Resolve the shared workspace package to its TypeScript source so ts-jest
    // (CommonJS) transforms it, avoiding the ESM-only dist build. The trailing
    // rule rewrites shared's internal `./x.js` specifiers to their `.ts` source.
    '^@bfn/shared/(.*)$': '<rootDir>/../shared/src/$1',
    '^@bfn/shared$': '<rootDir>/../shared/src/index',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
