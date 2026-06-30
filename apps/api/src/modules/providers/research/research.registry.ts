import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../../config/config.service';
import { RESEARCH_PROVIDERS } from '../provider.tokens';
import type { ResearchProvider } from './research-provider.interface';

export interface ResearchProviderStatus {
  id: string;
  available: boolean;
}

@Injectable()
export class ResearchRegistry {
  private readonly log = new Logger(ResearchRegistry.name);
  private readonly byId: Map<string, ResearchProvider>;

  constructor(
    @Inject(RESEARCH_PROVIDERS) providers: ResearchProvider[],
    private readonly config: AppConfigService,
  ) {
    this.byId = new Map(providers.map((p) => [p.id, p]));
  }

  /** preferred (if available) -> configured default -> mock. */
  resolve(preferredId?: string): ResearchProvider {
    const wanted = preferredId ?? this.config.research.defaultProvider;
    const provider = this.byId.get(wanted);
    if (provider?.isAvailable()) {
      return provider;
    }
    this.log.warn(
      provider
        ? `Research "${wanted}" has no credentials — falling back to mock`
        : `Research "${wanted}" is not registered — falling back to mock`,
    );
    const mock = this.byId.get('mock');
    if (!mock) {
      throw new Error('mock research provider is not registered');
    }
    return mock;
  }

  available(): ResearchProviderStatus[] {
    return [...this.byId.values()].map((p) => ({ id: p.id, available: p.isAvailable() }));
  }
}
