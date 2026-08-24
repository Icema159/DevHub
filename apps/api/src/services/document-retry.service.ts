import { randomUUID } from 'node:crypto';

import { DocumentStatus } from '../../../../generated/prisma/client.js';
import type { DocumentProcessingJobData } from '@developer-knowledge-hub/shared/queue/document-processing';

import {
  enqueueDocumentProcessing,
  type EnqueueDocumentProcessingOptions,
} from '../queues/document-processing.queue.js';
import {
  restartFailedDocumentByIdForUser,
  restoreFailedDocumentAfterRetryQueueFailure,
  type DocumentDetailRecord,
  type RestartFailedDocumentResult,
} from '../repositories/document.repository.js';
import { AppError } from '../utils/app-error.js';
import type { PublicDocumentDetail } from './document.service.js';

export interface DocumentRetryDependencies {
  restart(
    documentId: string,
    userId: string,
    retryStartedAt: Date,
  ): Promise<RestartFailedDocumentResult>;
  restoreAfterQueueFailure(
    documentId: string,
    userId: string,
    retryStartedAt: Date,
    processingError: string | null,
    processedAt: Date | null,
  ): Promise<boolean>;
  enqueue(
    data: DocumentProcessingJobData,
    options: EnqueueDocumentProcessingOptions,
  ): Promise<void>;
  now(): Date;
  createJobId(documentId: string): string;
}

const defaultDependencies: DocumentRetryDependencies = {
  restart: restartFailedDocumentByIdForUser,
  restoreAfterQueueFailure: restoreFailedDocumentAfterRetryQueueFailure,
  enqueue: enqueueDocumentProcessing,
  now: () => new Date(),
  createJobId: (documentId) => `manual-retry-${documentId}-${randomUUID()}`,
};

function documentNotFoundError(): AppError {
  return new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
}

function invalidDocumentStateError(): AppError {
  return new AppError(409, 'INVALID_DOCUMENT_STATE', 'Only failed documents can be retried.');
}

function toPublicDocumentDetail(document: DocumentDetailRecord): PublicDocumentDetail {
  return {
    id: document.id,
    filename: document.name,
    mimeType: document.mimeType,
    size: Number(document.sizeBytes),
    processingState: document.status,
    processingError: document.status === DocumentStatus.FAILED ? document.processingError : null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    processedAt: document.processedAt,
  };
}

export function createDocumentRetryService(
  dependencies: DocumentRetryDependencies = defaultDependencies,
) {
  return {
    async retryDocument(documentId: string, userId: string): Promise<PublicDocumentDetail> {
      const result = await dependencies.restart(documentId, userId, dependencies.now());

      if (result.outcome === 'not-found') {
        throw documentNotFoundError();
      }

      if (result.outcome === 'invalid-state') {
        throw invalidDocumentStateError();
      }

      if (result.outcome === 'processing-limit') {
        throw new AppError(
          409,
          'PROCESSING_LIMIT_REACHED',
          'You already have two documents being processed.',
        );
      }

      try {
        await dependencies.enqueue(
          { documentId, userId },
          { jobId: dependencies.createJobId(documentId) },
        );
      } catch (error) {
        console.error('Failed to enqueue manual document retry', {
          documentId,
          error: error instanceof Error ? error.message : 'Unknown processing queue error',
        });

        try {
          const restored = await dependencies.restoreAfterQueueFailure(
            documentId,
            userId,
            result.retryStartedAt,
            result.previousProcessingError,
            result.previousProcessedAt,
          );

          if (!restored) {
            console.error('Manual retry enqueue compensation did not restore the document', {
              documentId,
            });
          }
        } catch (restoreError) {
          console.error('Failed to restore document after manual retry enqueue failure', {
            documentId,
            error:
              restoreError instanceof Error
                ? restoreError.message
                : 'Unknown retry restoration error',
          });
        }

        throw new AppError(
          503,
          'PROCESSING_QUEUE_UNAVAILABLE',
          'Document processing is temporarily unavailable',
        );
      }

      return toPublicDocumentDetail(result.document);
    },
  };
}

export const documentRetryService = createDocumentRetryService();
