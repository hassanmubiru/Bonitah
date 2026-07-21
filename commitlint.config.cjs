/**
 * Commitlint configuration for the Bonitah Financial Network (BFN) monorepo.
 *
 * Enforces the Conventional Commits specification so that commit messages are
 * machine-parseable and consistent across the repository (Req 17.6).
 *
 * @see https://www.conventionalcommits.org/
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allowed commit types for this repository.
    'type-enum': [
      2,
      'always',
      [
        'build',
        'chore',
        'ci',
        'docs',
        'feat',
        'fix',
        'perf',
        'refactor',
        'revert',
        'style',
        'test',
      ],
    ],
    // Keep the subject readable; allow a generous but bounded header length.
    'header-max-length': [2, 'always', 100],
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
  },
};
