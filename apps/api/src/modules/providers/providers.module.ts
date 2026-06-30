import { Global, Module } from '@nestjs/common';
import { LLM_PROVIDERS, RESEARCH_PROVIDERS } from './provider.tokens';
import { LlmRegistry } from './llm/llm.registry';
import { ResearchRegistry } from './research/research.registry';
import { MockLlmProvider } from './llm/adapters/mock.adapter';
import { OpenAiLlmProvider } from './llm/adapters/openai.adapter';
import { AnthropicLlmProvider } from './llm/adapters/anthropic.adapter';
import { GeminiLlmProvider } from './llm/adapters/gemini.adapter';
import { MockResearchProvider } from './research/adapters/mock.adapter';
import { TavilyResearchProvider } from './research/adapters/tavily.adapter';
import { ProvidersController } from './providers.controller';
import type { LlmProvider } from './llm/llm-provider.interface';
import type { ResearchProvider } from './research/research-provider.interface';

/**
 * The adapter/plugin keystone. Each concrete adapter is its own provider; the
 * token factories collect them into arrays the registries select from (with mock
 * fallback). Adding a provider = one adapter class + one entry in the inject list.
 * Global so the research pipeline + others can inject the registries anywhere.
 */
@Global()
@Module({
  controllers: [ProvidersController],
  providers: [
    OpenAiLlmProvider,
    AnthropicLlmProvider,
    GeminiLlmProvider,
    MockLlmProvider,
    TavilyResearchProvider,
    MockResearchProvider,
    {
      provide: LLM_PROVIDERS,
      useFactory: (...providers: LlmProvider[]) => providers,
      inject: [OpenAiLlmProvider, AnthropicLlmProvider, GeminiLlmProvider, MockLlmProvider],
    },
    {
      provide: RESEARCH_PROVIDERS,
      useFactory: (...providers: ResearchProvider[]) => providers,
      inject: [TavilyResearchProvider, MockResearchProvider],
    },
    LlmRegistry,
    ResearchRegistry,
  ],
  exports: [LlmRegistry, ResearchRegistry],
})
export class ProvidersModule {}
