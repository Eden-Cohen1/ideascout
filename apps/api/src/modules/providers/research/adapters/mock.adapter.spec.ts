import { MockResearchProvider } from './mock.adapter';

describe('MockResearchProvider', () => {
  const provider = new MockResearchProvider();

  it('is always available (no key needed)', () => {
    expect(provider.isAvailable()).toBe(true);
  });

  it('search returns ranked results with valid URLs', async () => {
    const results = await provider.search({ query: 'ai onboarding', maxResults: 2 });
    expect(results).toHaveLength(2);
    expect(results[0].rank).toBe(1);
    expect(() => new URL(results[0].url)).not.toThrow();
  });

  it('search is deterministic', async () => {
    expect(await provider.search({ query: 'x' })).toEqual(await provider.search({ query: 'x' }));
  });

  it('fetch returns an ok page with content', async () => {
    const page = await provider.fetch('https://example.com');
    expect(page.status).toBe('ok');
    expect(page.url).toBe('https://example.com');
    expect(page.content.length).toBeGreaterThan(0);
  });
});
