import { EMBEDDING_DIMENSIONS, EmbeddingService } from '@developer-knowledge-hub/ai/embedding';
import { OpenAIEmbeddingProvider } from '@developer-knowledge-hub/ai/openai-embedding-provider';

import { env, requireOpenAiApiKey } from './env.js';

let embeddingService: EmbeddingService | undefined;

export function getEmbeddingService(): EmbeddingService {
  embeddingService ??= new EmbeddingService(
    new OpenAIEmbeddingProvider({
      apiKey: requireOpenAiApiKey(),
    }),
    {
      model: env.openaiEmbeddingModel,
      dimensions: EMBEDDING_DIMENSIONS,
    },
  );

  return embeddingService;
}
