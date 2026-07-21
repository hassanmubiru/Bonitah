#!/usr/bin/env node
/**
 * Staged-secret scanner for the Bonitah Financial Network (BFN) monorepo.
 *
 * Scans the *staged* content of files about to be committed for high-signal
 * secret patterns (private keys, cloud credentials, tokens, mnemonics, etc.).
 * When a secret is detected the process exits with a non-zero status so that
 * the pre-commit hook blocks the commit and the staged changes are preserved
 * unchanged (Req 16.8, 17.7).
 *
 * Design notes:
 * - Only staged blob content is scanned (via `git show :<path>`), so unstaged
 *   working-tree changes never mask or trigger a detection.
 * - Binary blobs and generated/vendored paths are skipped to keep the scan
 *   well within the pre-commit time budget (Req 17.6).
 * - Obvious placeholder values (e.g. `your-...`, `<...>`, `changeme`, `xxxx`)
 *   are ignored to reduce false positives in `.env.example`-style files.
 *
 * Usage:
 *   node scripts/secret-scan.mjs            # scan staged files (pre-commit)
 *   node scripts/secret-scan.mjs <files...> # scan explicit files (debug/test)
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Paths that never contain first-party secrets and are safe to skip. */
const IGNORED_PATH_PATTERNS = [
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)out\//,
  /(^|\/)coverage\//,
  /(^|\/)\.next\//,
  /(^|\/)contracts\/(out|cache|broadcast|lib)\//,
  /pnpm-lock\.yaml$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /\.(png|jpe?g|gif|webp|ico|svg|pdf|zip|gz|tar|woff2?|ttf|eot|mp4|mov|wasm)$/i,
];

/** Substrings that indicate a placeholder rather than a real secret. */
const PLACEHOLDER_HINTS = [
  'your-',
  'your_',
  'example',
  'changeme',
  'change-me',
  'placeholder',
  'dummy',
  'sample',
  'redacted',
  'xxxxxxxx',
  '<',
  '${',
  'process.env',
  'import.meta.env',
];

/**
 * High-signal secret detection rules. Each rule has a human-readable name and a
 * regular expression. Keep these targeted to minimize false positives.
 */
const RULES = [
  {
    name: 'Private key block (PEM)',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/,
  },
  {
    name: 'Ethereum / hex private key (32-byte)',
    regex: /\b(?:0x)?[0-9a-fA-F]{64}\b/,
    // Only flag when it looks like an assigned secret, not arbitrary hashes.
    requireSecretContext: true,
  },
  {
    name: 'AWS access key id',
    regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  },
  {
    name: 'AWS secret access key',
    regex: /\baws_secret_access_key\b\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/i,
  },
  {
    name: 'GitHub token',
    regex: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
  },
  {
    name: 'Slack token',
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  },
  {
    name: 'Google API key',
    regex: /\bAIza[0-9A-Za-z\-_]{35}\b/,
  },
  {
    name: 'OpenAI API key',
    regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  },
  {
    name: 'Stripe secret key',
    regex: /\b[rs]k_(?:live|test)_[A-Za-z0-9]{16,}\b/,
  },
  {
    name: 'JSON Web Token',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
  {
    name: 'BIP-39 style mnemonic (12+ words)',
    regex: /\b(?:[a-z]{3,8}\s+){11,}[a-z]{3,8}\b/,
    requireMnemonicContext: true,
  },
  {
    name: 'Generic secret assignment',
    regex:
      /\b(?:api[_-]?key|secret|token|password|passwd|pwd|private[_-]?key|access[_-]?key|client[_-]?secret|auth[_-]?token)\b\s*[:=]\s*['"][^'"\s]{12,}['"]/i,
    requireSecretContext: true,
  },
];

const SECRET_CONTEXT =
  /(api[_-]?key|secret|token|password|passwd|pwd|private[_-]?key|access[_-]?key|client[_-]?secret|auth[_-]?token|mnemonic|seed[_-]?phrase|credential)/i;

const MNEMONIC_CONTEXT = /(mnemonic|seed[_-]?phrase|recovery[_-]?phrase)/i;

function isBinary(content) {
  // Heuristic: presence of NUL byte indicates binary content.
  return content.includes('\u0000');
}

function isPlaceholder(line) {
  const lower = line.toLowerCase();
  return PLACEHOLDER_HINTS.some((hint) => lower.includes(hint));
}

function getStagedFiles() {
  const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], {
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);
}

function readStagedContent(file) {
  try {
    return execFileSync('git', ['show', `:${file}`], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

function scanContent(file, content) {
  const findings = [];
  if (content == null || isBinary(content)) return findings;

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || isPlaceholder(line)) continue;

    for (const rule of RULES) {
      if (rule.requireSecretContext && !SECRET_CONTEXT.test(line)) continue;
      if (rule.requireMnemonicContext && !MNEMONIC_CONTEXT.test(line)) continue;
      if (rule.regex.test(line)) {
        findings.push({ file, line: i + 1, rule: rule.name });
        break; // one finding per line is enough to block.
      }
    }
  }
  return findings;
}

function main() {
  const explicit = process.argv.slice(2);
  const usingExplicit = explicit.length > 0;
  const files = usingExplicit ? explicit : getStagedFiles();

  const scannable = files.filter((f) => !IGNORED_PATH_PATTERNS.some((re) => re.test(f)));

  const findings = [];
  for (const file of scannable) {
    const content = usingExplicit ? safeReadFile(file) : readStagedContent(file);
    findings.push(...scanContent(file, content));
  }

  if (findings.length > 0) {
    console.error(
      '\n\u001b[31m✖ Secret scan failed: potential secret(s) detected in staged changes.\u001b[0m\n',
    );
    for (const f of findings) {
      console.error(`  ${f.file}:${f.line}  →  ${f.rule}`);
    }
    console.error(
      '\nThe commit was blocked. Remove the secret(s) or move them to an untracked' +
        '\nenvironment file (see .env.example). If this is a false positive, adjust' +
        '\nthe value to a placeholder or update scripts/secret-scan.mjs.\n',
    );
    process.exit(1);
  }

  process.exit(0);
}

function safeReadFile(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

main();
