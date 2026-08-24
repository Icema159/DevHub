import { OpenAIEmbeddingProvider } from '../infrastructure/ai/openai-embedding.provider.js';
import { EMBEDDING_DIMENSIONS, EmbeddingService } from '../services/embedding.service.js';
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
