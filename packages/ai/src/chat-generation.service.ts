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

export interface ChatGenerationProvider {
  readonly providerName: string;
  generateAnswer(input: ChatGenerationProviderInput): Promise<ChatProviderResult>;
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
}
