import { prisma } from '../config/prisma.js';

export const DEFAULT_RETRIEVAL_LIMIT = 5;

export interface VectorSearchInput {
  userId: string;
  embedding: number[];
  embeddingModel: string;
  embeddingDimensions: number;
  limit?: number;
}

export interface RetrievedChunk {
  chunkId: string;
  content: string;
  documentId: string;
  documentName: string;
  chunkPosition: number;
  page: number | null;
  similarity: number;
}

function validateVectorSearchInput(input: VectorSearchInput): void {
  if (
    input.embedding.length !== input.embeddingDimensions ||
    input.embedding.some((value) => !Number.isFinite(value))
  ) {
    throw new Error('Vector search received an invalid embedding');
  }

  const limit = input.limit ?? DEFAULT_RETRIEVAL_LIMIT;

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error('Vector search limit must be a positive integer');
  }
}

export async function searchChunksByCosineSimilarity(
  input: VectorSearchInput,
): Promise<RetrievedChunk[]> {
  validateVectorSearchInput(input);

  const vectorLiteral = `[${input.embedding.join(',')}]`;
  const limit = input.limit ?? DEFAULT_RETRIEVAL_LIMIT;

  return prisma.$queryRaw<RetrievedChunk[]>`
    SELECT
      chunk."id" AS "chunkId",
      chunk."content",
      chunk."documentId",
      document."name" AS "documentName",
      chunk."position" AS "chunkPosition",
      CASE
        WHEN jsonb_typeof(chunk."metadata"->'pageNumber') = 'number'
        THEN (chunk."metadata"->>'pageNumber')::integer
        ELSE NULL
      END AS "page",
      (1 - (chunk."embedding" <=> ${vectorLiteral}::vector(1536)))::double precision AS "similarity"
    FROM "DocumentChunk" AS chunk
    INNER JOIN "Document" AS document ON document."id" = chunk."documentId"
    WHERE document."userId" = ${input.userId}
      AND document."deletedAt" IS NULL
      AND document."status" = 'READY'::"DocumentStatus"
      AND chunk."embedding" IS NOT NULL
      AND chunk."embeddingModel" = ${input.embeddingModel}
      AND chunk."embeddingDimensions" = ${input.embeddingDimensions}
    ORDER BY chunk."embedding" <=> ${vectorLiteral}::vector(1536)
    LIMIT ${limit}
  `;
}
