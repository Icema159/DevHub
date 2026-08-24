export const DOCUMENT_DELETION_QUEUE_NAME = 'document-deletion';
export const DOCUMENT_DELETION_JOB_NAME = 'document.delete';

export interface DocumentDeletionJobData {
  documentId: string;
  userId: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseDocumentDeletionJobData(value: unknown): DocumentDeletionJobData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Document deletion job data must be an object');
  }

  const { documentId, userId } = value as Record<string, unknown>;

  if (!isNonEmptyString(documentId) || !isNonEmptyString(userId)) {
    throw new Error('Document deletion job requires documentId and userId');
  }

  return { documentId, userId };
}
