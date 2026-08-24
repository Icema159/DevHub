import OpenAI from 'openai';

import type {
  ChatGenerationProvider,
  ChatGenerationProviderInput,
  ChatProviderResult,
  ChatTokenUsage,
} from './chat-generation.service.js';

export interface OpenAIChatGenerationProviderConfig {
  apiKey: string;
  maxRetries?: number;
  timeoutMs?: number;
}

export function formatChatGenerationInput(input: ChatGenerationProviderInput): string {
  const conversationContext = input.conversationContext?.trim();
  const conversationSection = conversationContext
    ? `<conversation_context>\n${conversationContext}\n</conversation_context>\n\n`
    : '';

  return `${conversationSection}<retrieved_context>\n${input.context}\n</retrieved_context>\n\n<user_question>\n${input.userQuestion}\n</user_question>`;
}

interface OpenAIResponseUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_tokens_details: {
    cached_tokens: number;
  };
  output_tokens_details: {
    reasoning_tokens: number;
  };
}

function toTokenUsage(usage: OpenAIResponseUsage | null | undefined): ChatTokenUsage | undefined {
  if (!usage) {
    return undefined;
  }

  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    totalTokens: usage.total_tokens,
    cachedInputTokens: usage.input_tokens_details.cached_tokens,
    reasoningTokens: usage.output_tokens_details.reasoning_tokens,
  };
}

export class OpenAIChatGenerationProvider implements ChatGenerationProvider {
  readonly providerName = 'openai';
  private readonly client: OpenAI;

  constructor(config: OpenAIChatGenerationProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      maxRetries: config.maxRetries ?? 0,
      timeout: config.timeoutMs ?? 60_000,
    });
  }

  async generateAnswer(input: ChatGenerationProviderInput): Promise<ChatProviderResult> {
    const response = await this.client.responses.create({
      model: input.model,
      instructions: input.systemInstructions,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: formatChatGenerationInput(input),
            },
          ],
        },
      ],
      max_output_tokens: input.maxOutputTokens,
      store: false,
    });

    const result: ChatProviderResult = {
      answer: response.output_text,
      model: response.model,
    };
    const usage = toTokenUsage(response.usage);

    if (usage) {
      result.usage = usage;
    }

    return result;
  }
}
