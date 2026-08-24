import { DocumentStatus } from '../../../../generated/prisma/client.js';
import type { DocumentProcessingJobData } from '@developer-knowledge-hub/shared/queue/document-processing';

import { objectStorageReader } from '../config/object-storage.js';
import { enqueueDocumentEmbedding } from '../queues/document-embedding.queue.js';
import {
  findDocumentForProcessing,
  markDocumentProcessingFailed,
  replaceDocumentChunksAndMarkChunksReady,
  transitionDocumentToProcessing,
  type ProcessingDocument,
} from '../repositories/document.repository.js';
import {
  documentChunker,
  type DocumentChunkDraft,
  type DocumentChunker,
} from './document-chunking.service.js';
import { NonRetryableDocumentProcessingError } from './document-processing.error.js';
import { validateStoredPdf } from './pdf-file-validation.js';
import { pdfParser, type PdfParser } from './pdf-parser.service.js';
import { ObjectStorageSizeMismatchError } from './object-storage.service.js';

export type DocumentProcessingResult =
  | { outcome: 'embedding-queued'; chunkCount: number | null }
  | { outcome: 'embedding-in-progress'; chunkCount: null }
  | { outcome: 'already-ready'; chunkCount: null }
  | { outcome: 'deleted'; chunkCount: null };

export class DocumentProcessingRejectedError extends NonRetryableDocumentProcessingError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = 'DocumentProcessingRejectedError';
  }
}

export interface DocumentProcessingDependencies {
  findDocument(documentId: string): Promise<ProcessingDocument | null>;
  transitionToProcessing(documentId: string, userId: string): Promise<boolean>;
  downloadFile(storageKey: string, expectedSizeBytes: bigint): Promise<Buffer>;
  parsePdf: PdfParser['extractText'];
  chunkPages: DocumentChunker['chunkPages'];
  completeProcessing(
    documentId: string,
    userId: string,
    chunks: DocumentChunkDraft[],
  ): Promise<boolean>;
  enqueueEmbedding(documentId: string, userId: string): Promise<void>;
  markFailed(documentId: string, userId: string, processingError: string): Promise<boolean>;
}

const defaultDependencies: DocumentProcessingDependencies = {
  findDocument: findDocumentForProcessing,
  transitionToProcessing: transitionDocumentToProcessing,
  downloadFile: (storageKey, expectedSizeBytes) =>
    objectStorageReader.downloadFile(storageKey, expectedSizeBytes),
  parsePdf: (content) => pdfParser.extractText(content),
  chunkPages: (pages) => documentChunker.chunkPages(pages),
  completeProcessing: replaceDocumentChunksAndMarkChunksReady,
  enqueueEmbedding: (documentId, userId) => enqueueDocumentEmbedding({ documentId, userId }),
  markFailed: markDocumentProcessingFailed,
};

function processingErrorMessage(error: unknown): string {
  if (error instanceof NonRetryableDocumentProcessingError) {
    return error.message.slice(0, 1000);
  }

  return 'Document processing failed during file retrieval or text extraction';
}

async function markProcessingFailure(
  dependencies: DocumentProcessingDependencies,
  jobData: DocumentProcessingJobData,
  error: unknown,
): Promise<void> {
  try {
    await dependencies.markFailed(
      jobData.documentId,
      jobData.userId,
      processingErrorMessage(error),
    );
  } catch (statusError) {
    console.error('Failed to record document processing failure', {
      documentId: jobData.documentId,
      error: statusError,
    });
  }
}

async function ensureProcessableDocument(
  dependencies: DocumentProcessingDependencies,
  jobData: DocumentProcessingJobData,
): Promise<ProcessingDocument | DocumentProcessingResult> {
  const document = await dependencies.findDocument(jobData.documentId);

  if (!document) {
    return { outcome: 'deleted', chunkCount: null };
  }

  if (document.userId !== jobData.userId) {
    throw new DocumentProcessingRejectedError(
      'DOCUMENT_OWNER_MISMATCH',
      'Document does not belong to the queued user',
    );
  }

  if (document.deletedAt) {
    return { outcome: 'deleted', chunkCount: null };
  }

  if (document.status === DocumentStatus.READY) {
    return { outcome: 'already-ready', chunkCount: null };
  }

  if (document.status === DocumentStatus.EMBEDDING) {
    return { outcome: 'embedding-in-progress', chunkCount: null };
  }

  if (document.status === DocumentStatus.CHUNKS_READY) {
    return document;
  }

  if (document.status === DocumentStatus.PENDING || document.status === DocumentStatus.FAILED) {
    const transitioned = await dependencies.transitionToProcessing(document.id, document.userId);

    if (!transitioned) {
      const currentDocument = await dependencies.findDocument(document.id);

      if (!currentDocument || currentDocument.deletedAt) {
        return { outcome: 'deleted', chunkCount: null };
      }

      if (currentDocument?.status === DocumentStatus.READY) {
        return { outcome: 'already-ready', chunkCount: null };
      }

      if (currentDocument?.status !== DocumentStatus.PROCESSING) {
        throw new DocumentProcessingRejectedError(
          'DOCUMENT_STATE_CHANGED',
          'Document state changed before processing could start',
        );
      }

      return currentDocument;
    }

    return {
      ...document,
      status: DocumentStatus.PROCESSING,
    };
  }

  if (document.status === DocumentStatus.PROCESSING) {
    return document;
  }

  throw new DocumentProcessingRejectedError(
    'DOCUMENT_STATUS_NOT_PROCESSABLE',
    `Document status ${document.status} does not allow processing`,
  );
}

export function createDocumentProcessingService(
  dependencies: DocumentProcessingDependencies = defaultDependencies,
) {
  return {
    async processDocument(jobData: DocumentProcessingJobData): Promise<DocumentProcessingResult> {
      const processableDocument = await ensureProcessableDocument(dependencies, jobData);

      if ('outcome' in processableDocument) {
        return processableDocument;
      }

      if (processableDocument.status === DocumentStatus.CHUNKS_READY) {
        await dependencies.enqueueEmbedding(processableDocument.id, processableDocument.userId);
        return { outcome: 'embedding-queued', chunkCount: null };
      }

      if (processableDocument.mimeType !== 'application/pdf') {
        throw new NonRetryableDocumentProcessingError(
          'UNSUPPORTED_DOCUMENT_TYPE',
          'Only PDF documents can be processed',
        );
      }

      let extractedPdf: Awaited<ReturnType<PdfParser['extractText']>>;

      try {
        const file = await dependencies.downloadFile(
          processableDocument.storageKey,
          processableDocument.sizeBytes,
        );
        validateStoredPdf(file, processableDocument.sizeBytes);
        extractedPdf = await dependencies.parsePdf(file);
      } catch (error) {
        const currentDocument = await dependencies.findDocument(processableDocument.id);

        if (!currentDocument || currentDocument.deletedAt) {
          return { outcome: 'deleted', chunkCount: null };
        }

        if (error instanceof ObjectStorageSizeMismatchError) {
          throw new NonRetryableDocumentProcessingError(
            'PDF_STORED_FILE_INVALID',
            'The stored PDF could not be validated safely',
          );
        }

        throw error;
      }

      const chunks = dependencies.chunkPages(extractedPdf.pages);

      if (chunks.length === 0) {
        throw new NonRetryableDocumentProcessingError(
          'DOCUMENT_CHUNKS_EMPTY',
          'The PDF did not produce any document chunks',
        );
      }

      const completed = await dependencies.completeProcessing(
        processableDocument.id,
        processableDocument.userId,
        chunks,
      );

      if (!completed) {
        const currentDocument = await dependencies.findDocument(processableDocument.id);

        if (!currentDocument || currentDocument.deletedAt) {
          return { outcome: 'deleted', chunkCount: null };
        }

        if (currentDocument?.status === DocumentStatus.READY) {
          return { outcome: 'already-ready', chunkCount: null };
        }

        if (currentDocument?.status === DocumentStatus.EMBEDDING) {
          return { outcome: 'embedding-in-progress', chunkCount: null };
        }

        if (currentDocument?.status === DocumentStatus.CHUNKS_READY) {
          await dependencies.enqueueEmbedding(currentDocument.id, currentDocument.userId);
          return { outcome: 'embedding-queued', chunkCount: null };
        }

        throw new DocumentProcessingRejectedError(
          'DOCUMENT_STATE_CHANGED',
          'Document state changed before processing could complete',
        );
      }

      await dependencies.enqueueEmbedding(processableDocument.id, processableDocument.userId);
      return { outcome: 'embedding-queued', chunkCount: chunks.length };
    },

    async recordFinalFailure(jobData: DocumentProcessingJobData, error: unknown): Promise<void> {
      await markProcessingFailure(dependencies, jobData, error);
    },
  };
}

export const documentProcessingService = createDocumentProcessingService();
