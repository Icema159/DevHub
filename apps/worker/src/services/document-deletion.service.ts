import type { DocumentDeletionJobData } from '@developer-knowledge-hub/shared/queue/document-deletion';

import { objectStorageDeleter } from '../config/object-storage.js';
import {
  findDocumentForDeletion,
  permanentlyDeleteDocumentData,
  type DeletionDocument,
} from '../repositories/document-deletion.repository.js';

export type DocumentDeletionResult = { outcome: 'deleted' } | { outcome: 'already-missing' };

export interface DocumentDeletionDependencies {
  findDocument(documentId: string, userId: string): Promise<DeletionDocument | null>;
  deleteFile(storageKey: string): Promise<void>;
  deleteDocumentData(documentId: string, userId: string, deletedAt: Date): Promise<boolean>;
}

const defaultDependencies: DocumentDeletionDependencies = {
  findDocument: findDocumentForDeletion,
  deleteFile: (storageKey) => objectStorageDeleter.deleteFile(storageKey),
  deleteDocumentData: permanentlyDeleteDocumentData,
};

export function createDocumentDeletionService(
  dependencies: DocumentDeletionDependencies = defaultDependencies,
) {
  return {
    async deleteDocument(jobData: DocumentDeletionJobData): Promise<DocumentDeletionResult> {
      const document = await dependencies.findDocument(jobData.documentId, jobData.userId);

      if (!document || !document.deletedAt) {
        return { outcome: 'already-missing' };
      }

      await dependencies.deleteFile(document.storageKey);
      const deleted = await dependencies.deleteDocumentData(
        document.id,
        document.userId,
        document.deletedAt,
      );

      return { outcome: deleted ? 'deleted' : 'already-missing' };
    },
  };
}

export const documentDeletionService = createDocumentDeletionService();
