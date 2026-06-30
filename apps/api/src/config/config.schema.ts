import { z } from 'zod';
import { LLM_PROVIDER_IDS, RESEARCH_PROVIDER_IDS } from '@ideascout/shared';

/**
 * Environment contract. Validated once at boot — the app fails fast on bad config.
 * Provider API keys are optional: when absent, that provider runs in mock mode.
 */
export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // base64 of a 256-bit key => 44 characters
  APP_ENCRYPTION_KEY: z.string().min(44),

  LLM_DEFAULT_PROVIDER: z.enum(LLM_PROVIDER_IDS).default('openai'),
  LLM_DEFAULT_MODEL: z.string().optional(),
  RESEARCH_DEFAULT_PROVIDER: z.enum(RESEARCH_PROVIDER_IDS).default('tavily'),

  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),

  // Comma-separated allowed CORS origins for the web frontend (e.g. http://localhost:5173).
  // Use '*' to reflect any origin. Empty => CORS disabled (same-origin only).
  CORS_ORIGINS: z.string().optional(),
});

export type AppConfig = z.infer<typeof configSchema>;

/** Parse + validate raw env; throws a readable error listing every problem. */
export function validateConfig(env: Record<string, unknown>): AppConfig {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
