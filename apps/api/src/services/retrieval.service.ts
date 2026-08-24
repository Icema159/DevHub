import {
  EMBEDDING_DIMENSIONS,
  type GeneratedEmbedding,
} from '@developer-knowledge-hub/ai/embedding';
import { AiOperation } from '../../../../generated/prisma/client.js';

import { env } from '../config/env.js';
import {
  DEFAULT_RETRIEVAL_LIMIT,
  type RetrievedChunk,
  searchChunksByCosineSimilarity,
  type VectorSearchInput,
} from '../repositories/vector.repository.js';
import { AppError } from '../utils/app-error.js';
import { AiBudgetUnavailableError, aiBudgetService } from './ai-budget.service.js';

export interface RetrievalDependencies {
  generateQuestionEmbedding(userId: string, question: string): Promise<GeneratedEmbedding>;
  searchChunks(input: VectorSearchInput): Promise<RetrievedChunk[]>;
}

const defaultDependencies: RetrievalDependencies = {
  async generateQuestionEmbedding(userId, question) {
    const [embedding] = await aiBudgetService.generateEmbeddings(
      userId,
      AiOperation.QUESTION_EMBEDDING,
      [question],
    );

    if (!embedding) {
      throw new Error('Embedding service did not return a question embedding');
    }

    return embedding;
  },
  searchChunks: searchChunksByCosineSimilarity,
};

export function createRetrievalService(dependencies: RetrievalDependencies = defaultDependencies) {
  return {
    async search(userId: string, question: string): Promise<RetrievedChunk[]> {
      let questionEmbedding: GeneratedEmbedding;

      try {
        questionEmbedding = await dependencies.generateQuestionEmbedding(userId, question);
      } catch (error) {
        if (error instanceof AiBudgetUnavailableError) {
          throw new AppError(
            503,
            'AI_TEMPORARILY_UNAVAILABLE',
            'AI features are temporarily unavailable.',
          );
        }
        throw new AppError(
          503,
          'EMBEDDING_PROVIDER_UNAVAILABLE',
          'Semantic search is temporarily unavailable',
        );
      }

      if (
        questionEmbedding.model !== env.openaiEmbeddingModel ||
        questionEmbedding.dimensions !== EMBEDDING_DIMENSIONS
      ) {
        throw new AppError(
          503,
          'EMBEDDING_CONFIGURATION_MISMATCH',
          'Semantic search is temporarily unavailable',
        );
      }

      return dependencies.searchChunks({
        userId,
        embedding: questionEmbedding.vector,
        embeddingModel: questionEmbedding.model,
        embeddingDimensions: questionEmbedding.dimensions,
        limit: DEFAULT_RETRIEVAL_LIMIT,
      });
    },
  };
}

export const retrievalService = createRetrievalService();
