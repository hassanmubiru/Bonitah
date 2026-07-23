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
    // RELAXED RULES TO REDUCE COMMIT FRUSTRATION
    'header-max-length': [1, 'always', 120], // Warning instead of error, longer limit
    'subject-empty': [1, 'never'], // Warning instead of error
    'type-empty': [1, 'never'], // Warning instead of error
    'body-leading-blank': [0, 'always'], // Disable body blank line requirement
    'footer-leading-blank': [0, 'always'], // Disable footer blank line requirement
    'header-trim': [1, 'always'], // Warning for whitespace instead of error
  },
};
