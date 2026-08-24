import OpenAI from 'openai';

import type {
  EmbeddingProvider,
  EmbeddingProviderResult,
  GenerateEmbeddingsInput,
} from './embedding.service.js';

export interface OpenAIEmbeddingProviderConfig {
  apiKey: string;
  maxRetries?: number;
  timeoutMs?: number;
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private readonly client: OpenAI;

  constructor(config: OpenAIEmbeddingProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      maxRetries: config.maxRetries ?? 0,
      timeout: config.timeoutMs ?? 30_000,
    });
  }

  async generateEmbeddings(input: GenerateEmbeddingsInput): Promise<EmbeddingProviderResult> {
    const response = await this.client.embeddings.create({
      input: input.texts,
      model: input.model,
      dimensions: input.dimensions,
      encoding_format: 'float',
    });

    return {
      vectors: [...response.data]
        .sort((left, right) => left.index - right.index)
        .map((item) => item.embedding),
      usage: {
        inputTokens: response.usage.prompt_tokens,
        totalTokens: response.usage.total_tokens,
      },
    };
  }
}
