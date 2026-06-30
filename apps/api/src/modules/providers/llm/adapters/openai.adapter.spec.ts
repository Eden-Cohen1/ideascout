import { OpenAiLlmProvider } from './openai.adapter';
import type { AppConfigService } from '../../../../config/config.service';

function cfg(key?: string): AppConfigService {
  return {
    providerKey: () => key,
    llm: { defaultProvider: 'openai', defaultModel: undefined },
  } as unknown as AppConfigService;
}

describe('OpenAiLlmProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('isAvailable reflects whether a key is configured', () => {
    expect(new OpenAiLlmProvider(cfg('sk')).isAvailable()).toBe(true);
    expect(new OpenAiLlmProvider(cfg(undefined)).isAvailable()).toBe(false);
  });

  it('chat posts to the chat-completions endpoint and parses the reply', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'gpt-x',
          choices: [{ message: { content: 'hi there' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 3, completion_tokens: 2 },
        }),
        { status: 200 },
      ),
    );

    const result = await new OpenAiLlmProvider(cfg('sk-test')).chat([
      { role: 'user', content: 'hello' },
    ]);

    expect(result.text).toBe('hi there');
    expect(result.usage).toEqual({ promptTokens: 3, completionTokens: 2 });
    expect(result.finishReason).toBe('stop');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/chat/completions');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    const body = JSON.parse(init?.body as string);
    expect(body.messages).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('throws a helpful error on a non-2xx response', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 401 }));
    await expect(
      new OpenAiLlmProvider(cfg('sk')).chat([{ role: 'user', content: 'x' }]),
    ).rejects.toThrow(/openai/i);
  });
});
