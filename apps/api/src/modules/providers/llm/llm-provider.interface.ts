import type { ZodType } from 'zod';

export type LlmRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LlmCallOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  seed?: number;
  signal?: AbortSignal;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
}

export type LlmFinishReason = 'stop' | 'length' | 'content_filter' | 'tool' | 'error';

export interface LlmChatResult {
  text: string;
  usage: LlmUsage;
  model: string;
  finishReason: LlmFinishReason;
}

export interface LlmStructuredResult<T> {
  value: T;
  usage: LlmUsage;
  model: string;
}

export interface LlmStreamChunk {
  delta: string;
  done: boolean;
}

/**
 * Stable contract every model provider implements (OpenAI default; Anthropic,
 * Gemini, Mock). Pipeline + chat code depend ONLY on this — never on a vendor SDK.
 */
export interface LlmProvider {
  readonly id: string;
  readonly defaultModel: string;

  /** True when the provider can actually serve requests (creds present, or it's mock). */
  isAvailable(): boolean;

  chat(messages: LlmMessage[], opts?: LlmCallOptions): Promise<LlmChatResult>;

  /** JSON/structured output validated against a Zod schema (retries+repairs once on parse failure). */
  structured<T>(
    messages: LlmMessage[],
    schema: ZodType<T>,
    opts?: LlmCallOptions & { schemaName?: string },
  ): Promise<LlmStructuredResult<T>>;

  /** Token streaming for refinement chat (not used by the deterministic pipeline). */
  stream(messages: LlmMessage[], opts?: LlmCallOptions): AsyncIterable<LlmStreamChunk>;
}
