import { AnthropicLlmProvider } from './anthropic.adapter';
import type { AppConfigService } from '../../../../config/config.service';

function cfg(key?: string): AppConfigService {
  return {
    providerKey: () => key,
    llm: { defaultProvider: 'anthropic', defaultModel: undefined },
  } as unknown as AppConfigService;
}

describe('AnthropicLlmProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('isAvailable reflects the key', () => {
    expect(new AnthropicLlmProvider(cfg('k')).isAvailable()).toBe(true);
    expect(new AnthropicLlmProvider(cfg(undefined)).isAvailable()).toBe(false);
  });

  it('posts to /v1/messages, splits the system prompt, and parses the reply', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'claude-x',
          content: [{ type: 'text', text: 'hi' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 4, output_tokens: 2 },
        }),
        { status: 200 },
      ),
    );

    const result = await new AnthropicLlmProvider(cfg('k')).chat([
      { role: 'system', content: 'be brief' },
      { role: 'user', content: 'hello' },
    ]);

    expect(result.text).toBe('hi');
    expect(result.usage).toEqual({ promptTokens: 4, completionTokens: 2 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v1/messages');
    const headers = init?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('k');
    expect(headers['anthropic-version']).toBeTruthy();
    const body = JSON.parse(init?.body as string);
    expect(body.system).toBe('be brief');
    expect(body.messages).toEqual([{ role: 'user', content: 'hello' }]);
    expect(body.max_tokens).toBeGreaterThan(0);
  });
});
