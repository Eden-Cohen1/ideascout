import { GeminiLlmProvider } from './gemini.adapter';
import type { AppConfigService } from '../../../../config/config.service';

function cfg(key?: string): AppConfigService {
  return {
    providerKey: () => key,
    llm: { defaultProvider: 'gemini', defaultModel: undefined },
  } as unknown as AppConfigService;
}

describe('GeminiLlmProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('isAvailable reflects the key', () => {
    expect(new GeminiLlmProvider(cfg('k')).isAvailable()).toBe(true);
    expect(new GeminiLlmProvider(cfg(undefined)).isAvailable()).toBe(false);
  });

  it('posts to generateContent, maps roles + system, and parses the reply', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'hi' }] }, finishReason: 'STOP' }],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3 },
          modelVersion: 'gemini-x',
        }),
        { status: 200 },
      ),
    );

    const result = await new GeminiLlmProvider(cfg('k')).chat([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hello' },
    ]);

    expect(result.text).toBe('hi');
    expect(result.usage).toEqual({ promptTokens: 5, completionTokens: 3 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(':generateContent');
    expect(String(url)).toContain('key=k');
    const body = JSON.parse(init?.body as string);
    expect(body.systemInstruction).toBeDefined();
    expect(body.contents[0].role).toBe('user');
    expect(body.contents[0].parts[0].text).toBe('hello');
  });
});
