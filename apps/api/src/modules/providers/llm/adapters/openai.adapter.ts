import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../../config/config.service';
import type {
  LlmCallOptions,
  LlmChatResult,
  LlmFinishReason,
  LlmMessage,
  LlmStreamChunk,
} from '../llm-provider.interface';
import { FetchLlmProvider } from './base.adapter';

interface OpenAiResponse {
  model?: string;
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const FINISH: Record<string, LlmFinishReason> = {
  stop: 'stop',
  length: 'length',
  content_filter: 'content_filter',
  tool_calls: 'tool',
  function_call: 'tool',
};

@Injectable()
export class OpenAiLlmProvider extends FetchLlmProvider {
  readonly id = 'openai';
  readonly defaultModel = 'gpt-4.1-mini';

  constructor(config: AppConfigService) {
    super(config);
  }

  protected async complete(
    messages: LlmMessage[],
    opts: LlmCallOptions | undefined,
    jsonMode: boolean,
  ): Promise<LlmChatResult> {
    const data = (await this.postJson(
      'https://api.openai.com/v1/chat/completions',
      { Authorization: `Bearer ${this.config.providerKey('openai')}` },
      {
        model: this.model(opts),
        messages,
        temperature: opts?.temperature ?? 0,
        ...(opts?.maxTokens ? { max_tokens: opts.maxTokens } : {}),
        ...(opts?.seed !== undefined ? { seed: opts.seed } : {}),
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      },
      opts?.signal,
    )) as OpenAiResponse;

    const choice = data.choices?.[0];
    return {
      text: choice?.message?.content ?? '',
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
      },
      model: data.model ?? this.model(opts),
      finishReason: FINISH[choice?.finish_reason ?? 'stop'] ?? 'stop',
    };
  }

  async *stream(
    messages: LlmMessage[],
    opts?: LlmCallOptions,
  ): AsyncIterable<LlmStreamChunk> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.providerKey('openai')}`,
      },
      body: JSON.stringify({
        model: this.model(opts),
        messages,
        temperature: opts?.temperature ?? 0.7,
        stream: true,
      }),
      signal: opts?.signal,
    });
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => '');
      throw new Error(`openai stream failed (${res.status}): ${detail.slice(0, 300)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE frames are separated by a blank line.
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const delta = this.parseStreamFrame(frame);
        if (delta === '[DONE]') {
          yield { delta: '', done: true };
          return;
        }
        if (delta) yield { delta, done: false };
      }
    }
    // Flush any bytes the streaming decoder buffered, then drain trailing frames.
    buffer += decoder.decode();
    let tailSep: number;
    while ((tailSep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, tailSep);
      buffer = buffer.slice(tailSep + 2);
      const delta = this.parseStreamFrame(frame);
      if (delta === '[DONE]') {
        yield { delta: '', done: true };
        return;
      }
      if (delta) yield { delta, done: false };
    }
    yield { delta: '', done: true };
  }

  /** Extract the token from one SSE frame, or '[DONE]' at end-of-stream, or '' to skip. */
  private parseStreamFrame(frame: string): string {
    const line = frame.split('\n').find((l) => l.startsWith('data:'));
    if (!line) return '';
    const payload = line.slice('data:'.length).trim();
    if (payload === '[DONE]') return '[DONE]';
    try {
      const json = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
      return json.choices?.[0]?.delta?.content ?? '';
    } catch {
      return '';
    }
  }
}
