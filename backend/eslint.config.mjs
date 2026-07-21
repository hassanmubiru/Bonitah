// @ts-check
import rootConfig from '../eslint.config.mjs';

/**
 * Backend ESLint configuration.
 *
 * Extends the monorepo root flat config and layers on NestJS-friendly
 * adjustments (decorator metadata patterns, Jest/Node globals).
 */
export default [
  ...rootConfig,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // NestJS relies heavily on parameter decorators and DI; interfaces are
      // frequently type-only. Keep unused-vars strict but allow `_` prefixes.
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // CommonJS tooling config files (e.g. jest.config.js) use `module.exports`.
    // ESM `.js` files are not used in the backend; ESM lives in `.mjs`.
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },
];
