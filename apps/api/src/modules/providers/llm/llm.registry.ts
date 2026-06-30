import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../../config/config.service';
import { LLM_PROVIDERS } from '../provider.tokens';
import type { LlmProvider } from './llm-provider.interface';

export interface LlmProviderStatus {
  id: string;
  available: boolean;
  defaultModel: string;
}

@Injectable()
export class LlmRegistry {
  private readonly log = new Logger(LlmRegistry.name);
  private readonly byId: Map<string, LlmProvider>;

  constructor(
    @Inject(LLM_PROVIDERS) providers: LlmProvider[],
    private readonly config: AppConfigService,
  ) {
    this.byId = new Map(providers.map((p) => [p.id, p]));
  }

  /** preferred (if available) -> configured default -> mock. */
  resolve(preferredId?: string): LlmProvider {
    const wanted = preferredId ?? this.config.llm.defaultProvider;
    const provider = this.byId.get(wanted);
    if (provider?.isAvailable()) {
      return provider;
    }
    this.log.warn(
      provider
        ? `LLM "${wanted}" has no credentials — falling back to mock`
        : `LLM "${wanted}" is not registered — falling back to mock`,
    );
    const mock = this.byId.get('mock');
    if (!mock) {
      throw new Error('mock LLM provider is not registered');
    }
    return mock;
  }

  available(): LlmProviderStatus[] {
    return [...this.byId.values()].map((p) => ({
      id: p.id,
      available: p.isAvailable(),
      defaultModel: p.defaultModel,
    }));
  }
}
