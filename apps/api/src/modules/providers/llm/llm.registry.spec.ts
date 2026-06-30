import { LlmRegistry } from './llm.registry';
import type { AppConfigService } from '../../../config/config.service';
import type { LlmProvider } from './llm-provider.interface';

function fakeLlm(id: string, available: boolean): LlmProvider {
  return {
    id,
    defaultModel: `${id}-model`,
    isAvailable: () => available,
    chat: jest.fn(),
    structured: jest.fn(),
    stream: jest.fn(),
  } as unknown as LlmProvider;
}

function registry(providers: LlmProvider[], defaultProvider: string): LlmRegistry {
  const config = { llm: { defaultProvider } } as AppConfigService;
  return new LlmRegistry(providers, config);
}

describe('LlmRegistry', () => {
  it('resolves the configured default when available', () => {
    const reg = registry([fakeLlm('openai', true), fakeLlm('mock', true)], 'openai');
    expect(reg.resolve().id).toBe('openai');
  });

  it('falls back to mock when the default has no credentials', () => {
    const reg = registry([fakeLlm('openai', false), fakeLlm('mock', true)], 'openai');
    expect(reg.resolve().id).toBe('mock');
  });

  it('honors an explicit preferredId over the default', () => {
    const reg = registry(
      [fakeLlm('openai', true), fakeLlm('anthropic', true), fakeLlm('mock', true)],
      'openai',
    );
    expect(reg.resolve('anthropic').id).toBe('anthropic');
  });

  it('falls back to mock for an unknown provider id', () => {
    const reg = registry([fakeLlm('mock', true)], 'openai');
    expect(reg.resolve('nope').id).toBe('mock');
  });

  it('reports availability for every provider', () => {
    const reg = registry([fakeLlm('openai', false), fakeLlm('mock', true)], 'openai');
    expect(reg.available()).toEqual(
      expect.arrayContaining([
        { id: 'openai', available: false, defaultModel: 'openai-model' },
        { id: 'mock', available: true, defaultModel: 'mock-model' },
      ]),
    );
  });
});
