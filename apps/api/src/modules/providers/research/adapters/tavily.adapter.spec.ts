import { TavilyResearchProvider } from './tavily.adapter';
import type { AppConfigService } from '../../../../config/config.service';

function cfg(key?: string): AppConfigService {
  return { providerKey: () => key } as unknown as AppConfigService;
}

describe('TavilyResearchProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('isAvailable reflects the key', () => {
    expect(new TavilyResearchProvider(cfg('k')).isAvailable()).toBe(true);
    expect(new TavilyResearchProvider(cfg(undefined)).isAvailable()).toBe(false);
  });

  it('search posts to Tavily and maps results to ranked SearchResults', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { title: 'T1', url: 'https://a.com', content: 'snippet1' },
            { title: 'T2', url: 'https://b.com', content: 'snippet2' },
          ],
        }),
        { status: 200 },
      ),
    );

    const results = await new TavilyResearchProvider(cfg('tvly-k')).search({
      query: 'ai',
      maxResults: 2,
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      title: 'T1',
      url: 'https://a.com',
      snippet: 'snippet1',
      rank: 1,
    });
    expect(results[1].rank).toBe(2);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('tavily.com');
    const body = JSON.parse(init?.body as string);
    expect(body.query).toBe('ai');
  });

  it('fetch retrieves a page and strips HTML to text', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html><head><style>x{}</style></head><body><p>Hello world</p></body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );
    const page = await new TavilyResearchProvider(cfg('k')).fetch('https://x.com');
    expect(page.status).toBe('ok');
    expect(page.content).toContain('Hello world');
    expect(page.content).not.toContain('<p>');
  });

  it('returns an error page status when the fetch fails', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    const page = await new TavilyResearchProvider(cfg('k')).fetch('https://x.com');
    expect(page.status).toBe('error');
  });
});
