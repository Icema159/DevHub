import { DocumentStatus, Prisma } from '../../../../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import type { DocumentChunkDraft } from '../services/document-chunking.service.js';

const processingDocumentSelect = {
  id: true,
  userId: true,
  storageKey: true,
  mimeType: true,
  sizeBytes: true,
  status: true,
  deletedAt: true,
} as const;

export type ProcessingDocument = Prisma.DocumentGetPayload<{
  select: typeof processingDocumentSelect;
}>;

class DocumentCompletionConflictError extends Error {}

export async function findDocumentForProcessing(
  documentId: string,
): Promise<ProcessingDocument | null> {
  return prisma.document.findUnique({
    where: { id: documentId },
    select: processingDocumentSelect,
  });
}

export async function transitionDocumentToProcessing(
  documentId: string,
  userId: string,
): Promise<boolean> {
  const result = await prisma.document.updateMany({
    where: {
      id: documentId,
      userId,
      deletedAt: null,
      status: {
        in: [DocumentStatus.PENDING, DocumentStatus.FAILED],
      },
    },
    data: {
      status: DocumentStatus.PROCESSING,
      processingError: null,
      processedAt: null,
    },
  });

  return result.count === 1;
}

export async function replaceDocumentChunksAndMarkChunksReady(
  documentId: string,
  userId: string,
  chunks: DocumentChunkDraft[],
): Promise<boolean> {
  try {
    await prisma.$transaction(async (transaction) => {
      const result = await transaction.document.updateMany({
        where: {
          id: documentId,
          userId,
          deletedAt: null,
          status: DocumentStatus.PROCESSING,
        },
        data: {
          status: DocumentStatus.CHUNKS_READY,
          processingError: null,
          processedAt: null,
        },
      });

      if (result.count !== 1) {
        throw new DocumentCompletionConflictError();
      }

      await transaction.documentChunk.deleteMany({
        where: { documentId },
      });

      await transaction.documentChunk.createMany({
        data: chunks.map((chunk) => ({
          documentId,
          position: chunk.position,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          metadata: chunk.metadata,
        })),
      });
    });

    return true;
  } catch (error) {
    if (error instanceof DocumentCompletionConflictError) {
      return false;
    }

    throw error;
  }
}

export async function markDocumentProcessingFailed(
  documentId: string,
  userId: string,
  processingError: string,
): Promise<boolean> {
  const result = await prisma.document.updateMany({
    where: {
      id: documentId,
      userId,
      deletedAt: null,
      status: {
        in: [DocumentStatus.PROCESSING, DocumentStatus.CHUNKS_READY],
      },
    },
    data: {
      status: DocumentStatus.FAILED,
      processingError,
      processedAt: null,
    },
  });

  return result.count === 1;
}
