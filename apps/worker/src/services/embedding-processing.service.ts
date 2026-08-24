import { DocumentStatus } from '../../../../generated/prisma/client.js';
import type { DocumentEmbeddingJobData } from '@developer-knowledge-hub/shared/queue/document-embedding';

import { env } from '../config/env.js';
import {
  findChunksForEmbedding,
  findDocumentForEmbedding,
  markDocumentEmbeddingFailed,
  storeChunkEmbeddingsAndMarkReady,
  transitionDocumentToEmbedding,
  type ChunkEmbeddingWrite,
  type EmbeddingChunk,
  type EmbeddingDocument,
} from '../repositories/embedding.repository.js';
import { NonRetryableDocumentProcessingError } from './document-processing.error.js';
import { EMBEDDING_DIMENSIONS, type GeneratedEmbedding } from './embedding.service.js';
import { type PreparedDocumentEmbeddings, workerAiBudgetService } from './ai-budget.service.js';

export type EmbeddingProcessingResult =
  | { outcome: 'ready'; embeddedChunkCount: number }
  | { outcome: 'already-ready'; embeddedChunkCount: 0 }
  | { outcome: 'deleted'; embeddedChunkCount: 0 };

export class EmbeddingProcessingRejectedError extends NonRetryableDocumentProcessingError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = 'EmbeddingProcessingRejectedError';
  }
}

export interface EmbeddingProcessingDependencies {
  model: string;
  dimensions: number;
  findDocument(documentId: string): Promise<EmbeddingDocument | null>;
  transitionToEmbedding(documentId: string, userId: string): Promise<boolean>;
  findChunks(documentId: string): Promise<EmbeddingChunk[]>;
  prepareEmbeddings(userId: string, texts: string[]): Promise<PreparedDocumentEmbeddings>;
  completeEmbedding(
    documentId: string,
    userId: string,
    embeddings: ChunkEmbeddingWrite[],
    expectedModel: string,
    expectedDimensions: number,
  ): Promise<boolean>;
  markFailed(documentId: string, userId: string, processingError: string): Promise<boolean>;
}

const defaultDependencies: EmbeddingProcessingDependencies = {
  model: env.openaiEmbeddingModel,
  dimensions: EMBEDDING_DIMENSIONS,
  findDocument: findDocumentForEmbedding,
  transitionToEmbedding: transitionDocumentToEmbedding,
  findChunks: findChunksForEmbedding,
  prepareEmbeddings: (userId, texts) =>
    workerAiBudgetService.prepareDocumentEmbeddings(userId, texts),
  completeEmbedding: storeChunkEmbeddingsAndMarkReady,
  markFailed: markDocumentEmbeddingFailed,
};

async function markEmbeddingFailure(
  dependencies: EmbeddingProcessingDependencies,
  jobData: DocumentEmbeddingJobData,
): Promise<void> {
  try {
    await dependencies.markFailed(
      jobData.documentId,
      jobData.userId,
      'Document embedding generation failed',
    );
  } catch (statusError) {
    console.error('Failed to record document embedding failure', {
      documentId: jobData.documentId,
      error: statusError,
    });
  }
}

async function ensureEmbeddableDocument(
  dependencies: EmbeddingProcessingDependencies,
  jobData: DocumentEmbeddingJobData,
): Promise<EmbeddingDocument | EmbeddingProcessingResult> {
  const document = await dependencies.findDocument(jobData.documentId);

  if (!document) {
    return { outcome: 'deleted', embeddedChunkCount: 0 };
  }

  if (document.userId !== jobData.userId) {
    throw new EmbeddingProcessingRejectedError(
      'DOCUMENT_OWNER_MISMATCH',
      'Document does not belong to the queued user',
    );
  }

  if (document.deletedAt) {
    return { outcome: 'deleted', embeddedChunkCount: 0 };
  }

  if (document.status === DocumentStatus.READY) {
    return { outcome: 'already-ready', embeddedChunkCount: 0 };
  }

  if (
    document.status === DocumentStatus.CHUNKS_READY ||
    document.status === DocumentStatus.FAILED ||
    document.status === DocumentStatus.EMBEDDING
  ) {
    return document;
  }

  throw new EmbeddingProcessingRejectedError(
    'DOCUMENT_STATUS_NOT_EMBEDDABLE',
    `Document status ${document.status} does not allow embedding`,
  );
}

function needsEmbedding(chunk: EmbeddingChunk, model: string, dimensions: number): boolean {
  return (
    !chunk.hasEmbedding ||
    chunk.embeddingModel !== model ||
    chunk.embeddingDimensions !== dimensions
  );
}

export function createEmbeddingProcessingService(
  dependencies: EmbeddingProcessingDependencies = defaultDependencies,
) {
  return {
    async processDocumentEmbeddings(
      jobData: DocumentEmbeddingJobData,
    ): Promise<EmbeddingProcessingResult> {
      const embeddableDocument = await ensureEmbeddableDocument(dependencies, jobData);

      if ('outcome' in embeddableDocument) {
        return embeddableDocument;
      }

      const chunks = await dependencies.findChunks(embeddableDocument.id);

      if (chunks.length === 0) {
        const currentDocument = await dependencies.findDocument(embeddableDocument.id);

        if (!currentDocument || currentDocument.deletedAt) {
          return { outcome: 'deleted', embeddedChunkCount: 0 };
        }

        throw new EmbeddingProcessingRejectedError(
          'DOCUMENT_CHUNKS_NOT_FOUND',
          'Document chunks are not available for embedding',
        );
      }

      const chunksToEmbed = chunks.filter((chunk) =>
        needsEmbedding(chunk, dependencies.model, dependencies.dimensions),
      );
      const prepared =
        chunksToEmbed.length > 0
          ? await dependencies.prepareEmbeddings(
              embeddableDocument.userId,
              chunksToEmbed.map((chunk) => chunk.content),
            )
          : null;

      if (embeddableDocument.status !== DocumentStatus.EMBEDDING) {
        const transitioned = await dependencies.transitionToEmbedding(
          embeddableDocument.id,
          embeddableDocument.userId,
        );

        if (!transitioned) {
          await prepared?.release();
          const currentDocument = await dependencies.findDocument(embeddableDocument.id);

          if (!currentDocument || currentDocument.deletedAt) {
            return { outcome: 'deleted', embeddedChunkCount: 0 };
          }

          if (currentDocument.status === DocumentStatus.READY) {
            return { outcome: 'already-ready', embeddedChunkCount: 0 };
          }

          if (currentDocument.status !== DocumentStatus.EMBEDDING) {
            throw new EmbeddingProcessingRejectedError(
              'DOCUMENT_STATE_CHANGED',
              'Document state changed before embedding could start',
            );
          }
        }
      }

      let generated: GeneratedEmbedding[];

      try {
        generated = prepared ? await prepared.generate() : [];
      } catch (error) {
        const currentDocument = await dependencies.findDocument(embeddableDocument.id);

        if (!currentDocument || currentDocument.deletedAt) {
          return { outcome: 'deleted', embeddedChunkCount: 0 };
        }

        throw error;
      }

      if (generated.length !== chunksToEmbed.length) {
        throw new Error('Embedding service returned a different number of vectors than chunks');
      }

      const embeddings = chunksToEmbed.map((chunk, index): ChunkEmbeddingWrite => {
        const generatedEmbedding = generated[index];

        if (!generatedEmbedding) {
          throw new Error('Generated embedding is missing for a document chunk');
        }

        return {
          chunkId: chunk.id,
          vector: generatedEmbedding.vector,
          model: generatedEmbedding.model,
          dimensions: generatedEmbedding.dimensions,
        };
      });

      const completed = await dependencies.completeEmbedding(
        embeddableDocument.id,
        embeddableDocument.userId,
        embeddings,
        dependencies.model,
        dependencies.dimensions,
      );

      if (!completed) {
        const currentDocument = await dependencies.findDocument(embeddableDocument.id);

        if (!currentDocument || currentDocument.deletedAt) {
          return { outcome: 'deleted', embeddedChunkCount: 0 };
        }

        if (currentDocument?.status === DocumentStatus.READY) {
          return { outcome: 'already-ready', embeddedChunkCount: 0 };
        }

        throw new EmbeddingProcessingRejectedError(
          'DOCUMENT_STATE_CHANGED',
          'Document state changed before embedding could complete',
        );
      }

      return {
        outcome: 'ready',
        embeddedChunkCount: embeddings.length,
      };
    },

    async recordFinalFailure(jobData: DocumentEmbeddingJobData): Promise<void> {
      await markEmbeddingFailure(dependencies, jobData);
    },
  };
}

export const embeddingProcessingService = createEmbeddingProcessingService();
