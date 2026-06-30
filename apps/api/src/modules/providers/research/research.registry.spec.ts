import { ResearchRegistry } from './research.registry';
import type { AppConfigService } from '../../../config/config.service';
import type { ResearchProvider } from './research-provider.interface';

function fakeResearch(id: string, available: boolean): ResearchProvider {
  return {
    id,
    isAvailable: () => available,
    search: jest.fn(),
    fetch: jest.fn(),
  } as unknown as ResearchProvider;
}

function registry(providers: ResearchProvider[], defaultProvider: string): ResearchRegistry {
  const config = { research: { defaultProvider } } as AppConfigService;
  return new ResearchRegistry(providers, config);
}

describe('ResearchRegistry', () => {
  it('resolves the configured default when available', () => {
    const reg = registry([fakeResearch('tavily', true), fakeResearch('mock', true)], 'tavily');
    expect(reg.resolve().id).toBe('tavily');
  });

  it('falls back to mock when the default has no credentials', () => {
    const reg = registry([fakeResearch('tavily', false), fakeResearch('mock', true)], 'tavily');
    expect(reg.resolve().id).toBe('mock');
  });

  it('reports availability for every provider', () => {
    const reg = registry([fakeResearch('tavily', false), fakeResearch('mock', true)], 'tavily');
    expect(reg.available()).toEqual(
      expect.arrayContaining([
        { id: 'tavily', available: false },
        { id: 'mock', available: true },
      ]),
    );
  });
});
