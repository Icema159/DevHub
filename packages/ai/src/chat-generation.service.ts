import { performance } from 'node:perf_hooks';

export interface ChatGenerationInput {
  systemInstructions: string;
  conversationContext?: string;
  context: string;
  userQuestion: string;
}

export interface ChatTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
}

export interface ChatProviderResult {
  answer: string;
  model: string;
  usage?: ChatTokenUsage;
}

export interface ChatGenerationProviderInput extends ChatGenerationInput {
  model: string;
  maxOutputTokens: number;
}

export type ChatProviderStreamEvent =
  { type: 'delta'; delta: string } | { type: 'completed'; result: ChatProviderResult };

export type ChatGenerationStreamEvent =
  { type: 'delta'; delta: string } | { type: 'completed'; result: GeneratedChatAnswer };

export interface ChatGenerationStreamOptions {
  signal?: AbortSignal;
}

export interface ChatGenerationProvider {
  readonly providerName: string;
  generateAnswer(input: ChatGenerationProviderInput): Promise<ChatProviderResult>;
  streamAnswer?(
    input: ChatGenerationProviderInput,
    options?: ChatGenerationStreamOptions,
  ): AsyncIterable<ChatProviderStreamEvent>;
}

export interface ChatGenerationServiceConfig {
  model: string;
  maxOutputTokens: number;
  now?: () => number;
}

export interface GeneratedChatAnswer extends ChatProviderResult {
  provider: string;
  generationDurationMs: number;
}

function requireText(name: string, value: string): void {
  if (!value.trim()) {
    throw new Error(`${name} must not be empty`);
  }
}

export class ChatGenerationService {
  private readonly now: () => number;

  constructor(
    private readonly provider: ChatGenerationProvider,
    private readonly config: ChatGenerationServiceConfig,
  ) {
    requireText('Chat model', config.model);

    if (!Number.isInteger(config.maxOutputTokens) || config.maxOutputTokens <= 0) {
      throw new Error('Chat max output tokens must be a positive integer');
    }

    this.now = config.now ?? performance.now.bind(performance);
  }

  async generateAnswer(input: ChatGenerationInput): Promise<GeneratedChatAnswer> {
    requireText('System instructions', input.systemInstructions);
    requireText('Context', input.context);
    requireText('User question', input.userQuestion);

    const startedAt = this.now();
    const result = await this.provider.generateAnswer({
      ...input,
      model: this.config.model,
      maxOutputTokens: this.config.maxOutputTokens,
    });
    const generationDurationMs = Math.max(0, Math.round(this.now() - startedAt));

    requireText('Generated answer', result.answer);
    requireText('Returned chat model', result.model);

    return {
      ...result,
      provider: this.provider.providerName,
      generationDurationMs,
    };
  }

  async *streamAnswer(
    input: ChatGenerationInput,
    options: ChatGenerationStreamOptions = {},
  ): AsyncGenerator<ChatGenerationStreamEvent> {
    requireText('System instructions', input.systemInstructions);
    requireText('Context', input.context);
    requireText('User question', input.userQuestion);

    const startedAt = this.now();
    const providerInput = {
      ...input,
      model: this.config.model,
      maxOutputTokens: this.config.maxOutputTokens,
    };

    if (!this.provider.streamAnswer) {
      const result = await this.provider.generateAnswer(providerInput);
      const generationDurationMs = Math.max(0, Math.round(this.now() - startedAt));

      requireText('Generated answer', result.answer);
      requireText('Returned chat model', result.model);

      yield {
        type: 'completed',
        result: {
          ...result,
          provider: this.provider.providerName,
          generationDurationMs,
        },
      };
      return;
    }

    let completed = false;

    for await (const event of this.provider.streamAnswer(providerInput, options)) {
      if (event.type === 'delta') {
        if (completed) {
          throw new Error('Chat provider emitted output after completion');
        }
        if (event.delta) {
          yield event;
        }
        continue;
      }

      if (completed) {
        throw new Error('Chat provider emitted more than one completion');
      }
      completed = true;

      const generationDurationMs = Math.max(0, Math.round(this.now() - startedAt));
      requireText('Generated answer', event.result.answer);
      requireText('Returned chat model', event.result.model);
      yield {
        type: 'completed',
        result: {
          ...event.result,
          provider: this.provider.providerName,
          generationDurationMs,
        },
      };
    }

    if (!completed) {
      throw new Error('Chat provider stream ended before completion');
    }
  }
}
