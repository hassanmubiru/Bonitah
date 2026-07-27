import { z } from 'zod';

/**
 * Canonical Base Sepolia chain id. All BFN on-chain interactions occur on this
 * network (Req 1.1).
 */
export const BASE_SEPOLIA_CHAIN_ID = 84532;

/**
 * Zod schema describing every environment variable the backend requires.
 *
 * Validation runs once at process startup so that a misconfigured environment
 * fails fast with an explicit, aggregated error instead of surfacing as an
 * obscure runtime fault later (Req 16.7).
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  PORT: z.coerce.number().int().positive().max(65535).default(3001),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /** Comma-separated allowed CORS origins. */
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  /** PostgreSQL connection string (off-chain data only, Req 1.3). */
  DATABASE_URL: z.string().url(),

  /** Redis connection string. */
  REDIS_URL: z.string().url(),

  /** Base Sepolia JSON-RPC endpoint. */
  BASE_SEPOLIA_RPC_URL: z.string().url(),

  /** Expected chain id; must be Base Sepolia (Req 1.1). */
  CHAIN_ID: z.coerce
    .number()
    .int()
    .default(BASE_SEPOLIA_CHAIN_ID)
    .refine((value) => value === BASE_SEPOLIA_CHAIN_ID, {
      message: `CHAIN_ID must be ${BASE_SEPOLIA_CHAIN_ID} (Base Sepolia)`,
    }),

  /** JWT signing secret. Wired fully in the auth task; must be strong. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  JWT_EXPIRES_IN: z.string().default('24h'),

  /** OpenAI key is optional at boot; the AI module validates presence on use. */
  OPENAI_API_KEY: z.string().optional(),

  /** DeepSeek API key for AI assistant (optional alternative to OpenAI). */
  DEEPSEEK_API_KEY: z.string().optional(),

  /** DeepSeek API base URL. */
  DEEPSEEK_BASE_URL: z.string().url().default('https://api.deepseek.com'),

  /** Ollama base URL for local AI models. */
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),

  /** Ollama model name to use. */
  OLLAMA_MODEL: z.string().default('llama3.1:8b'),

  /** AI Provider selection: 'openai', 'deepseek', 'ollama', or 'auto' */
  AI_PROVIDER: z.enum(['openai', 'deepseek', 'ollama', 'auto']).default('auto'),

  /** Pinata JWT for IPFS uploads (Req 3.5, 8.4). */
  PINATA_JWT: z.string().optional(),

  /** Pinata IPFS gateway URL for content retrieval. */
  PINATA_GATEWAY: z.string().url().optional(),

  /** Private key for certificate issuer account with ISSUER_ROLE (Req 8.3). */
  ISSUER_PRIVATE_KEY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional(),
});

/** Fully-typed, validated environment shape. */
export type Env = z.infer<typeof envSchema>;

/**
 * Validate a raw environment record against {@link envSchema}.
 *
 * @throws Error with an aggregated, human-readable message listing every
 * invalid or missing variable. The message intentionally names only variable
 * keys and validation messages, never the offending secret values (Req 16.7).
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid backend environment configuration:\n${issues}`);
  }

  return parsed.data;
}
