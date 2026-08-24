export const DOCUMENT_PROCESSING_QUEUE_NAME = 'document-processing';
export const DOCUMENT_PROCESSING_JOB_NAME = 'document.process';

export interface DocumentProcessingJobData {
  documentId: string;
  userId: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseDocumentProcessingJobData(value: unknown): DocumentProcessingJobData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Document processing job data must be an object');
  }

  const { documentId, userId } = value as Record<string, unknown>;

  if (!isNonEmptyString(documentId) || !isNonEmptyString(userId)) {
    throw new Error('Document processing job requires documentId and userId');
  }

  return { documentId, userId };
}
