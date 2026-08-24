export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_BATCH_SIZE = 100;

export interface GenerateEmbeddingsInput {
  texts: string[];
  model: string;
  dimensions: number;
}

export interface EmbeddingProvider {
  generateEmbeddings(input: GenerateEmbeddingsInput): Promise<EmbeddingProviderResult>;
}

export interface EmbeddingTokenUsage {
  inputTokens: number;
  totalTokens: number;
}

export interface EmbeddingProviderResult {
  vectors: number[][];
  usage?: EmbeddingTokenUsage;
}

export interface EmbeddingServiceConfig {
  model: string;
  dimensions: number;
  batchSize?: number;
}

export interface GeneratedEmbedding {
  vector: number[];
  model: string;
  dimensions: number;
}

export interface EmbeddingBatchUsage {
  inputTokens: number;
  totalTokens: number;
}

export interface GenerateEmbeddingsResult {
  embeddings: GeneratedEmbedding[];
  usage?: EmbeddingBatchUsage;
}

function validateVector(vector: number[], dimensions: number): void {
  if (vector.length !== dimensions || vector.some((value) => !Number.isFinite(value))) {
    throw new Error(`Embedding provider returned an invalid ${dimensions}-dimension vector`);
  }
}

export class EmbeddingService {
  private readonly batchSize: number;

  constructor(
    private readonly provider: EmbeddingProvider,
    private readonly config: EmbeddingServiceConfig,
  ) {
    this.batchSize = config.batchSize ?? EMBEDDING_BATCH_SIZE;

    if (!config.model.trim()) {
      throw new Error('Embedding model must not be empty');
    }

    if (!Number.isInteger(config.dimensions) || config.dimensions <= 0) {
      throw new Error('Embedding dimensions must be a positive integer');
    }

    if (!Number.isInteger(this.batchSize) || this.batchSize <= 0) {
      throw new Error('Embedding batch size must be a positive integer');
    }
  }

  async generateEmbeddingsWithUsage(texts: string[]): Promise<GenerateEmbeddingsResult> {
    if (texts.length === 0 || texts.some((text) => !text.trim())) {
      throw new Error('Embedding input must contain non-empty text');
    }

    const generated: GeneratedEmbedding[] = [];
    let inputTokens = 0;
    let totalTokens = 0;
    let hasUsage = true;

    for (let offset = 0; offset < texts.length; offset += this.batchSize) {
      const batch = texts.slice(offset, offset + this.batchSize);
      const result = await this.provider.generateEmbeddings({
        texts: batch,
        model: this.config.model,
        dimensions: this.config.dimensions,
      });
      const { vectors } = result;

      if (result.usage) {
        inputTokens += result.usage.inputTokens;
        totalTokens += result.usage.totalTokens;
      } else {
        hasUsage = false;
      }

      if (vectors.length !== batch.length) {
        throw new Error('Embedding provider returned a different number of vectors than inputs');
      }

      for (const vector of vectors) {
        validateVector(vector, this.config.dimensions);
        generated.push({
          vector,
          model: this.config.model,
          dimensions: this.config.dimensions,
        });
      }
    }

    return {
      embeddings: generated,
      ...(hasUsage ? { usage: { inputTokens, totalTokens } } : {}),
    };
  }

  async generateEmbeddings(texts: string[]): Promise<GeneratedEmbedding[]> {
    return (await this.generateEmbeddingsWithUsage(texts)).embeddings;
  }
}
