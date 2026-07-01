import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../../config/config.service';
import { LLM_PROVIDERS } from '../provider.tokens';
import type { LlmProvider } from './llm-provider.interface';

export interface LlmProviderStatus {
  id: string;
  available: boolean;
  defaultModel: string;
}

/** A project's provider/model selection, resolved against config + provider defaults. */
export interface ResolvedLlm {
  /** The requested provider id (selection → global default), before mock fallback. */
  providerId: string;
  /** The concrete provider to use (mock fallback applied). */
  provider: LlmProvider;
  /** The model id to use (selection → global default → the provider's default). */
  model: string;
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

  /**
   * Resolve a project's LLM selection into the provider + model to use. The single
   * source of the provider/model fallback cascade shared by the research pipeline and
   * the refinement loop. Callers pass the already-merged selection (e.g. per-run
   * override ?? project default); this appends the global-config and provider defaults.
   */
  resolveForProject(selection: { provider?: string | null; model?: string | null }): ResolvedLlm {
    const providerId = selection.provider ?? this.config.llm.defaultProvider;
    const provider = this.resolve(providerId);
    const model = selection.model ?? this.config.llm.defaultModel ?? provider.defaultModel;
    return { providerId, provider, model };
  }

  available(): LlmProviderStatus[] {
    return [...this.byId.values()].map((p) => ({
      id: p.id,
      available: p.isAvailable(),
      defaultModel: p.defaultModel,
    }));
  }
}
