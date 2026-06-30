import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../../config/config.service';
import type {
  LlmCallOptions,
  LlmChatResult,
  LlmFinishReason,
  LlmMessage,
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
}
