import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * Frontend ESLint flat config. Bridges Next.js's eslintrc-style shareable
 * configs into ESLint 9 flat config via FlatCompat, matching the monorepo's
 * ESLint 9 baseline.
 */
const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['.next/**', 'out/**', 'node_modules/**', 'next-env.d.ts'],
  },
];

export default eslintConfig;
