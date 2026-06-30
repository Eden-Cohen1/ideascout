import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../../config/config.service';
import type {
  LlmCallOptions,
  LlmChatResult,
  LlmFinishReason,
  LlmMessage,
} from '../llm-provider.interface';
import { FetchLlmProvider } from './base.adapter';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  modelVersion?: string;
}

const FINISH: Record<string, LlmFinishReason> = {
  STOP: 'stop',
  MAX_TOKENS: 'length',
  SAFETY: 'content_filter',
  RECITATION: 'content_filter',
};

@Injectable()
export class GeminiLlmProvider extends FetchLlmProvider {
  readonly id = 'gemini';
  readonly defaultModel = 'gemini-2.5-flash';

  constructor(config: AppConfigService) {
    super(config);
  }

  protected async complete(
    messages: LlmMessage[],
    opts: LlmCallOptions | undefined,
    jsonMode: boolean,
  ): Promise<LlmChatResult> {
    const model = this.model(opts);
    const key = this.config.providerKey('gemini') ?? '';
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const data = (await this.postJson(
      url,
      {},
      {
        contents,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        generationConfig: {
          temperature: opts?.temperature ?? 0,
          ...(opts?.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
          ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      },
      opts?.signal,
    )) as GeminiResponse;

    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    return {
      text,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
      model: data.modelVersion ?? model,
      finishReason: FINISH[candidate?.finishReason ?? 'STOP'] ?? 'stop',
    };
  }
}
