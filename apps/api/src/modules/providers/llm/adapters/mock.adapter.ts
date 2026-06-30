import { Injectable } from '@nestjs/common';
import type { ZodType } from 'zod';
import type {
  LlmCallOptions,
  LlmChatResult,
  LlmMessage,
  LlmProvider,
  LlmStreamChunk,
  LlmStructuredResult,
  LlmUsage,
} from '../llm-provider.interface';
import { synthFromSchema } from './synth-from-schema';

const zeroUsage = (): LlmUsage => ({ promptTokens: 0, completionTokens: 0 });

/**
 * Deterministic, schema-aware mock. ALWAYS available — the registry falls back to
 * it when a real provider has no key, so the app runs end-to-end with no network.
 */
@Injectable()
export class MockLlmProvider implements LlmProvider {
  readonly id = 'mock';
  readonly defaultModel = 'mock-1';

  isAvailable(): boolean {
    return true;
  }

  async chat(messages: LlmMessage[]): Promise<LlmChatResult> {
    const last = messages.at(-1)?.content ?? '';
    return {
      text: `MOCK: ${last.slice(0, 120)}`,
      usage: zeroUsage(),
      model: this.defaultModel,
      finishReason: 'stop',
    };
  }

  async structured<T>(
    _messages: LlmMessage[],
    schema: ZodType<T>,
    _opts?: LlmCallOptions,
  ): Promise<LlmStructuredResult<T>> {
    // parse() applies defaults/coercion and guarantees a valid value.
    const value = schema.parse(synthFromSchema(schema));
    return { value, usage: zeroUsage(), model: this.defaultModel };
  }

  async *stream(messages: LlmMessage[]): AsyncIterable<LlmStreamChunk> {
    const text = `MOCK reply to: ${messages.at(-1)?.content ?? ''}`;
    for (const token of text.split(' ')) {
      yield { delta: `${token} `, done: false };
    }
    yield { delta: '', done: true };
  }
}
