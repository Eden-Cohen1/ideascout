import { Injectable } from '@nestjs/common';
import type { AppConfig } from './config.schema';

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

  /** Raw provider API key, or undefined when unset (=> that provider runs in mock mode). */
  providerKey(id: string): string | undefined {
    switch (id) {
      case 'openai':
        return this.config.OPENAI_API_KEY;
      case 'anthropic':
        return this.config.ANTHROPIC_API_KEY;
      case 'gemini':
        return this.config.GEMINI_API_KEY;
      case 'tavily':
        return this.config.TAVILY_API_KEY;
      default:
        return undefined;
    }
  }
}
