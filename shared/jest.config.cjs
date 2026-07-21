/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*(\\.spec|\\.test)\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.spec.json',
      },
    ],
  },
  collectCoverageFrom: ['src/**/*.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    // The shared package is authored as ESM using explicit `./x.js` specifiers.
    // ts-jest transforms to CommonJS, so rewrite those specifiers to their
    // extensionless module names (mirrors the backend jest setup).
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
