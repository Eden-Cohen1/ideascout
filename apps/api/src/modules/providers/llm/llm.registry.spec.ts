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

  describe('resolveForProject', () => {
    it('uses the selection provider + model when given', () => {
      const reg = registry(
        [fakeLlm('openai', true), fakeLlm('anthropic', true), fakeLlm('mock', true)],
        'openai',
      );
      const r = reg.resolveForProject({ provider: 'anthropic', model: 'claude-x' });
      expect(r.providerId).toBe('anthropic');
      expect(r.provider.id).toBe('anthropic');
      expect(r.model).toBe('claude-x');
    });

    it('falls back to the config default provider and the provider default model', () => {
      const reg = registry([fakeLlm('openai', true), fakeLlm('mock', true)], 'openai');
      const r = reg.resolveForProject({});
      expect(r.providerId).toBe('openai');
      expect(r.model).toBe('openai-model');
    });

    it('keeps the requested providerId even when the provider falls back to mock', () => {
      const reg = registry([fakeLlm('openai', false), fakeLlm('mock', true)], 'openai');
      const r = reg.resolveForProject({ provider: 'openai' });
      expect(r.providerId).toBe('openai'); // recorded as requested
      expect(r.provider.id).toBe('mock'); // but actually served by mock
      expect(r.model).toBe('mock-model');
    });
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
