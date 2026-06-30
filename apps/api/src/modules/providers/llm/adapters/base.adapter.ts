import type { ZodType } from 'zod';
import type { AppConfigService } from '../../../../config/config.service';
import type {
  LlmCallOptions,
  LlmChatResult,
  LlmMessage,
  LlmProvider,
  LlmStreamChunk,
  LlmStructuredResult,
} from '../llm-provider.interface';

function extractJson(text: string): unknown {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/, '')
      .trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    return undefined;
  }
}

/**
 * Shared logic for fetch-based LLM providers. Concrete adapters implement only the
 * provider-specific HTTP in complete(); structured() (JSON + zod-parse + one repair)
 * and stream() are handled here, identically across providers.
 */
export abstract class FetchLlmProvider implements LlmProvider {
  abstract readonly id: string;
  abstract readonly defaultModel: string;

  constructor(protected readonly config: AppConfigService) {}

  isAvailable(): boolean {
    return this.config.providerKey(this.id) !== undefined;
  }

  protected model(opts?: LlmCallOptions): string {
    return opts?.model ?? this.config.llm.defaultModel ?? this.defaultModel;
  }

  /** Provider-specific HTTP call. `jsonMode` asks the backend to return JSON. */
  protected abstract complete(
    messages: LlmMessage[],
    opts: LlmCallOptions | undefined,
    jsonMode: boolean,
  ): Promise<LlmChatResult>;

  chat(messages: LlmMessage[], opts?: LlmCallOptions): Promise<LlmChatResult> {
    return this.complete(messages, opts, false);
  }

  async structured<T>(
    messages: LlmMessage[],
    schema: ZodType<T>,
    opts?: LlmCallOptions,
  ): Promise<LlmStructuredResult<T>> {
    let errText = '';
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const attemptMessages: LlmMessage[] =
        attempt === 0
          ? messages
          : [
              ...messages,
              {
                role: 'user',
                content: `Your previous response failed validation: ${errText}. Return ONLY corrected JSON, no prose.`,
              },
            ];
      const res = await this.complete(
        attemptMessages,
        { ...opts, temperature: opts?.temperature ?? 0 },
        true,
      );
      const parsed = schema.safeParse(extractJson(res.text));
      if (parsed.success) {
        return { value: parsed.data, usage: res.usage, model: res.model };
      }
      errText = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
    }
    throw new Error(`Structured output failed schema validation: ${errText}`);
  }

  async *stream(messages: LlmMessage[], opts?: LlmCallOptions): AsyncIterable<LlmStreamChunk> {
    // True token streaming arrives in the refinement milestone; emit once for now.
    const res = await this.complete(messages, opts, false);
    yield { delta: res.text, done: false };
    yield { delta: '', done: true };
  }

  protected async postJson(
    url: string,
    headers: Record<string, string>,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`${this.id} request failed (${res.status}): ${detail.slice(0, 300)}`);
    }
    return res.json();
  }
}
