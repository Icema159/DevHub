import type { DocumentDeletionJobData } from '@developer-knowledge-hub/shared/queue/document-deletion';

import { enqueueDocumentDeletion } from '../queues/document-deletion.queue.js';
import {
  releaseDocumentQuotaReservation,
  restoreDeletedDocumentAndReleaseHold,
  softDeleteWithQuotaHold,
} from '../repositories/resource-quota.repository.js';
import { AppError } from '../utils/app-error.js';

export interface PublicDeletedDocument {
  id: string;
  deletedAt: Date;
}

export interface DocumentDeletionDependencies {
  softDelete(
    documentId: string,
    userId: string,
    deletedAt: Date,
  ): Promise<{ reservationId: string } | null>;
  releaseHold(reservationId: string, userId: string): Promise<void>;
  restoreAfterQueueFailure(
    documentId: string,
    userId: string,
    deletedAt: Date,
    reservationId: string,
  ): Promise<boolean>;
  enqueue(data: DocumentDeletionJobData): Promise<void>;
  now(): Date;
}

const defaultDependencies: DocumentDeletionDependencies = {
  softDelete: softDeleteWithQuotaHold,
  releaseHold: releaseDocumentQuotaReservation,
  restoreAfterQueueFailure: restoreDeletedDocumentAndReleaseHold,
  enqueue: enqueueDocumentDeletion,
  now: () => new Date(),
};

function documentNotFoundError(): AppError {
  return new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
}

export function createDocumentDeletionService(
  dependencies: DocumentDeletionDependencies = defaultDependencies,
) {
  return {
    async deleteDocument(documentId: string, userId: string): Promise<PublicDeletedDocument> {
      const deletedAt = dependencies.now();
      const hold = await dependencies.softDelete(documentId, userId, deletedAt);

      if (!hold) {
        throw documentNotFoundError();
      }

      try {
        await dependencies.enqueue({ documentId, userId });
        await dependencies.releaseHold(hold.reservationId, userId);
      } catch (error) {
        console.error('Failed to enqueue document cleanup', {
          documentId,
          error: error instanceof Error ? error.message : 'Unknown cleanup queue error',
        });

        try {
          const restored = await dependencies.restoreAfterQueueFailure(
            documentId,
            userId,
            deletedAt,
            hold.reservationId,
          );

          if (!restored) {
            console.error('Document deletion enqueue compensation did not restore the document', {
              documentId,
            });
          }
        } catch (restoreError) {
          console.error('Failed to restore document after cleanup enqueue failure', {
            documentId,
            error:
              restoreError instanceof Error ? restoreError.message : 'Unknown restoration error',
          });
        }

        throw new AppError(
          503,
          'DOCUMENT_DELETION_QUEUE_UNAVAILABLE',
          'Document deletion is temporarily unavailable',
        );
      }

      return { id: documentId, deletedAt };
    },
  };
}

export const documentDeletionService = createDocumentDeletionService();
