import { z } from 'zod';
import { FetchLlmProvider } from './base.adapter';
import type { AppConfigService } from '../../../../config/config.service';
import type { LlmCallOptions, LlmChatResult, LlmMessage } from '../llm-provider.interface';

class StubProvider extends FetchLlmProvider {
  readonly id = 'stub';
  readonly defaultModel = 'stub-1';
  responses: string[] = [];
  calls = 0;

  constructor() {
    super({
      providerKey: () => 'k',
      llm: { defaultProvider: 'stub' },
    } as unknown as AppConfigService);
  }

  protected async complete(
    _messages: LlmMessage[],
    _opts: LlmCallOptions | undefined,
    _jsonMode: boolean,
  ): Promise<LlmChatResult> {
    const text = this.responses[this.calls] ?? '';
    this.calls += 1;
    return {
      text,
      usage: { promptTokens: 1, completionTokens: 1 },
      model: this.defaultModel,
      finishReason: 'stop',
    };
  }
}

const schema = z.object({ n: z.number() });
const msgs: LlmMessage[] = [{ role: 'user', content: 'x' }];

describe('FetchLlmProvider.structured', () => {
  it('parses valid JSON output', async () => {
    const p = new StubProvider();
    p.responses = ['{"n": 5}'];
    expect((await p.structured(msgs, schema)).value).toEqual({ n: 5 });
  });

  it('strips markdown code fences', async () => {
    const p = new StubProvider();
    p.responses = ['```json\n{"n": 7}\n```'];
    expect((await p.structured(msgs, schema)).value).toEqual({ n: 7 });
  });

  it('repairs once on invalid output then succeeds', async () => {
    const p = new StubProvider();
    p.responses = ['not json at all', '{"n": 9}'];
    expect((await p.structured(msgs, schema)).value).toEqual({ n: 9 });
    expect(p.calls).toBe(2);
  });

  it('throws when repair still fails', async () => {
    const p = new StubProvider();
    p.responses = ['bad', 'still bad'];
    await expect(p.structured(msgs, schema)).rejects.toThrow();
  });
});

describe('FetchLlmProvider chat/stream', () => {
  it('chat delegates to complete', async () => {
    const p = new StubProvider();
    p.responses = ['hello'];
    expect((await p.chat(msgs)).text).toBe('hello');
  });

  it('stream yields the completion then done', async () => {
    const p = new StubProvider();
    p.responses = ['streamed'];
    const chunks = [];
    for await (const c of p.stream(msgs)) chunks.push(c);
    expect(chunks).toEqual([
      { delta: 'streamed', done: false },
      { delta: '', done: true },
    ]);
  });
});
