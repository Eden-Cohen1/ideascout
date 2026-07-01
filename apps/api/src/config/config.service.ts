import { Injectable } from '@nestjs/common';
import type { LlmProviderId, ResearchProviderId } from '@ideascout/shared';
import type { AppConfig } from './config.schema';

/**
 * Provider id -> env var holding its API key. Keyed by the provider-id union so a
 * typo or missing provider is a compile error (not a silent mock fallback).
 * `mock` is intentionally absent (it needs no key).
 */
const PROVIDER_ENV_KEYS = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
  tavily: 'TAVILY_API_KEY',
} as const satisfies Partial<Record<LlmProviderId | ResearchProviderId, keyof AppConfig>>;

/** Typed, read-only access to validated configuration. */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: AppConfig) {}

  get nodeEnv(): AppConfig['NODE_ENV'] {
    return this.config.NODE_ENV;
  }

  get isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  get port(): number {
    return this.config.PORT;
  }

  get databaseUrl(): string {
    return this.config.DATABASE_URL;
  }

  get redisUrl(): string {
    return this.config.REDIS_URL;
  }

  get jwt(): { secret: string; expiresIn: string } {
    return { secret: this.config.JWT_SECRET, expiresIn: this.config.JWT_EXPIRES_IN };
  }

  get encryptionKey(): string {
    return this.config.APP_ENCRYPTION_KEY;
  }

  get llm(): { defaultProvider: AppConfig['LLM_DEFAULT_PROVIDER']; defaultModel?: string } {
    return {
      defaultProvider: this.config.LLM_DEFAULT_PROVIDER,
      defaultModel: this.config.LLM_DEFAULT_MODEL,
    };
  }

  get research(): { defaultProvider: AppConfig['RESEARCH_DEFAULT_PROVIDER'] } {
    return { defaultProvider: this.config.RESEARCH_DEFAULT_PROVIDER };
  }

  /** Artificial per-step delay (ms) for the research pipeline; 0 = none. */
  get researchStepDelayMs(): number {
    return this.config.RESEARCH_STEP_DELAY_MS;
  }

  /** Allowed CORS origins (parsed from the comma-separated CORS_ORIGINS). */
  get corsOrigins(): string[] {
    return (this.config.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  /** Raw provider API key, or undefined when unset (=> that provider runs in mock mode). */
  providerKey(id: string): string | undefined {
    if (id in PROVIDER_ENV_KEYS) {
      return this.config[PROVIDER_ENV_KEYS[id as keyof typeof PROVIDER_ENV_KEYS]];
    }
    return undefined;
  }
}
