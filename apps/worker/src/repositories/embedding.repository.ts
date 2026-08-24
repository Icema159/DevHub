import { DocumentStatus } from '../../../../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';

export interface EmbeddingDocument {
  id: string;
  userId: string;
  status: DocumentStatus;
  deletedAt: Date | null;
}

export interface EmbeddingChunk {
  id: string;
  documentId: string;
  position: number;
  content: string;
  embeddingModel: string | null;
  embeddingDimensions: number | null;
  hasEmbedding: boolean;
}

export interface ChunkEmbeddingWrite {
  chunkId: string;
  vector: number[];
  model: string;
  dimensions: number;
}

class EmbeddingCompletionConflictError extends Error {}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

export async function findDocumentForEmbedding(
  documentId: string,
): Promise<EmbeddingDocument | null> {
  return prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      userId: true,
      status: true,
      deletedAt: true,
    },
  });
}

export async function transitionDocumentToEmbedding(
  documentId: string,
  userId: string,
): Promise<boolean> {
  const result = await prisma.document.updateMany({
    where: {
      id: documentId,
      userId,
      deletedAt: null,
      status: {
        in: [DocumentStatus.CHUNKS_READY, DocumentStatus.FAILED],
      },
    },
    data: {
      status: DocumentStatus.EMBEDDING,
      processingError: null,
      processedAt: null,
    },
  });

  return result.count === 1;
}

export async function findChunksForEmbedding(documentId: string): Promise<EmbeddingChunk[]> {
  return prisma.$queryRaw<EmbeddingChunk[]>`
    SELECT
      chunk."id",
      chunk."documentId",
      chunk."position",
      chunk."content",
      chunk."embeddingModel",
      chunk."embeddingDimensions",
      chunk."embedding" IS NOT NULL AS "hasEmbedding"
    FROM "DocumentChunk" AS chunk
    INNER JOIN "Document" AS document ON document."id" = chunk."documentId"
    WHERE chunk."documentId" = ${documentId}
      AND document."deletedAt" IS NULL
    ORDER BY chunk."position" ASC
  `;
}

export async function storeChunkEmbeddingsAndMarkReady(
  documentId: string,
  userId: string,
  embeddings: ChunkEmbeddingWrite[],
  expectedModel: string,
  expectedDimensions: number,
): Promise<boolean> {
  try {
    await prisma.$transaction(async (transaction) => {
      for (const embedding of embeddings) {
        const updated = await transaction.$executeRaw`
          UPDATE "DocumentChunk"
          SET
            "embedding" = ${toVectorLiteral(embedding.vector)}::vector(1536),
            "embeddingModel" = ${embedding.model},
            "embeddingDimensions" = ${embedding.dimensions},
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${embedding.chunkId}
            AND "documentId" = ${documentId}
        `;

        if (updated !== 1) {
          throw new EmbeddingCompletionConflictError();
        }
      }

      const missingRows = await transaction.$queryRaw<Array<{ hasMissingEmbedding: boolean }>>`
        SELECT EXISTS (
          SELECT 1
          FROM "DocumentChunk"
          WHERE "documentId" = ${documentId}
            AND (
              "embedding" IS NULL
              OR "embeddingModel" IS DISTINCT FROM ${expectedModel}
              OR "embeddingDimensions" IS DISTINCT FROM ${expectedDimensions}
            )
        ) AS "hasMissingEmbedding"
      `;

      if (missingRows[0]?.hasMissingEmbedding !== false) {
        throw new EmbeddingCompletionConflictError();
      }

      const documentUpdate = await transaction.document.updateMany({
        where: {
          id: documentId,
          userId,
          deletedAt: null,
          status: DocumentStatus.EMBEDDING,
        },
        data: {
          status: DocumentStatus.READY,
          processingError: null,
          processedAt: new Date(),
        },
      });

      if (documentUpdate.count !== 1) {
        throw new EmbeddingCompletionConflictError();
      }
    });

    return true;
  } catch (error) {
    if (error instanceof EmbeddingCompletionConflictError) {
      return false;
    }

    throw error;
  }
}

export async function markDocumentEmbeddingFailed(
  documentId: string,
  userId: string,
  processingError: string,
): Promise<boolean> {
  const result = await prisma.document.updateMany({
    where: {
      id: documentId,
      userId,
      deletedAt: null,
      status: DocumentStatus.EMBEDDING,
    },
    data: {
      status: DocumentStatus.FAILED,
      processingError,
      processedAt: null,
    },
  });

  return result.count === 1;
}
