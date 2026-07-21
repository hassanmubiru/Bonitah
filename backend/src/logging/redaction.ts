/**
 * Redaction rules shared by the HTTP logger and application-level logs.
 *
 * BFN must guarantee that no secrets or PII ever reach the logs (Req 16.7,
 * and the PII exclusion posture of Req 3.8). We enforce this with two
 * complementary strategies:
 *
 * 1. A whitelist approach for HTTP request/response serialization: only known
 *    safe fields (method, url, status, request id) are emitted, so headers,
 *    cookies, and bodies are never logged by default.
 * 2. A deny-list of sensitive key fragments used by pino's `redact` option as
 *    a defense-in-depth backstop for any structured field that slips through.
 */

/** Placeholder written in place of any redacted value. */
export const REDACTION_PLACEHOLDER = '[REDACTED]';

/**
 * Case-insensitive key fragments that indicate a value must never be logged.
 * Matches secrets (tokens, keys, passwords) and PII (email, phone, address,
 * government id, financial account credentials per Req 3.8).
 */
export const SENSITIVE_KEY_FRAGMENTS: readonly string[] = [
  'authorization',
  'cookie',
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'accesskey',
  'access_key',
  'privatekey',
  'private_key',
  'mnemonic',
  'seed',
  'signature',
  'jwt',
  'credential',
  'email',
  'phone',
  'ssn',
  'govid',
  'gov_id',
  'nationalid',
  'national_id',
  'address',
  'dob',
  'dateofbirth',
];

/**
 * Explicit dot-path redaction targets handed to pino's `redact` option. These
 * cover the common HTTP locations where secrets appear.
 */
export const PINO_REDACT_PATHS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'res.headers["set-cookie"]',
  'req.body.password',
  'req.body.token',
  'req.body.jwt',
  'req.body.signature',
  'req.body.secret',
  'req.body.privateKey',
  'req.body.mnemonic',
  'req.body.email',
  'req.body.phone',
  '*.password',
  '*.token',
  '*.secret',
  '*.jwt',
  '*.authorization',
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_\s]/g, '');
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment.replace(/[-_\s]/g, '')),
  );
}

/**
 * Recursively redact sensitive values from an arbitrary structured payload,
 * returning a new value with offending fields replaced by
 * {@link REDACTION_PLACEHOLDER}. Used for application-level structured logs
 * before they are handed to the logger.
 *
 * Cycles are handled via a visited set so self-referential objects do not
 * cause infinite recursion.
 */
export function redactSensitive(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value as object)) {
    return REDACTION_PLACEHOLDER;
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveKey(key) ? REDACTION_PLACEHOLDER : redactSensitive(entry, seen);
  }
  return result;
}
