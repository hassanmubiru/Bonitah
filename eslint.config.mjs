// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Root ESLint flat configuration for the BFN monorepo.
 * Workspace packages may extend this base with framework-specific rules.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/out/**',
      '**/coverage/**',
      // Foundry-generated artifacts and vendored dependencies.
      'contracts/out/**',
      'contracts/cache/**',
      'contracts/lib/**',
      'contracts/broadcast/**',
      // Root-level lib directory with OpenZeppelin contracts
      'lib/**',
      // Scripts directory (build/deploy utilities)
      'scripts/**',
      'shared/scripts/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Relaxed rules for test files
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '**/test/**/*', '**/tests/**/*', '**/__tests__/**/*'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/triple-slash-reference': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-case-declarations': 'off',
      'no-console': 'off',
      'no-undef': 'off',
      'prefer-const': 'off',
    },
  },
  {
    // Relaxed rules for configuration files
    files: ['**/*.config.js', '**/*.config.cjs', '**/*.setup.js', '**/next-env.d.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/triple-slash-reference': 'off',
      'no-undef': 'off',
    },
  },
  {
    // CommonJS tooling config files (e.g. jest.config.js) use `module.exports`.
    // ESM sources live in `.mjs`/`.ts`; no `.js` file in the repo uses ESM.
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },
  {
    // Node-executed JS/MJS scripts and config files. TS files get no-undef
    // handling from typescript-eslint, so this only affects plain JS family.
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
  },
  prettier,
);
