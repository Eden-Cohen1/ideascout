import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../../config/config.service';
import type {
  LlmCallOptions,
  LlmChatResult,
  LlmFinishReason,
  LlmMessage,
} from '../llm-provider.interface';
import { FetchLlmProvider } from './base.adapter';

interface AnthropicResponse {
  model?: string;
  content?: { type: string; text?: string }[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

const FINISH: Record<string, LlmFinishReason> = {
  end_turn: 'stop',
  stop_sequence: 'stop',
  max_tokens: 'length',
  tool_use: 'tool',
};

@Injectable()
export class AnthropicLlmProvider extends FetchLlmProvider {
  readonly id = 'anthropic';
  readonly defaultModel = 'claude-sonnet-4-6';

  constructor(config: AppConfigService) {
    super(config);
  }

  protected async complete(
    messages: LlmMessage[],
    opts: LlmCallOptions | undefined,
    _jsonMode: boolean,
  ): Promise<LlmChatResult> {
    // Anthropic takes the system prompt separately from the user/assistant turns.
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');
    const conversation = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const data = (await this.postJson(
      'https://api.anthropic.com/v1/messages',
      {
        'x-api-key': this.config.providerKey('anthropic') ?? '',
        'anthropic-version': '2023-06-01',
      },
      {
        model: this.model(opts),
        max_tokens: opts?.maxTokens ?? 4096,
        temperature: opts?.temperature ?? 0,
        ...(system ? { system } : {}),
        messages: conversation,
      },
      opts?.signal,
    )) as AnthropicResponse;

    const text = (data.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');
    return {
      text,
      usage: {
        promptTokens: data.usage?.input_tokens ?? 0,
        completionTokens: data.usage?.output_tokens ?? 0,
      },
      model: data.model ?? this.model(opts),
      finishReason: FINISH[data.stop_reason ?? 'end_turn'] ?? 'stop',
    };
  }
}
