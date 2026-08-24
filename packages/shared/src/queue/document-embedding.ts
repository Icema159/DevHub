export const DOCUMENT_EMBEDDING_QUEUE_NAME = 'document-embedding';
export const DOCUMENT_EMBEDDING_JOB_NAME = 'document.embed';

export interface DocumentEmbeddingJobData {
  documentId: string;
  userId: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseDocumentEmbeddingJobData(value: unknown): DocumentEmbeddingJobData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Document embedding job data must be an object');
  }

  const { documentId, userId } = value as Record<string, unknown>;

  if (!isNonEmptyString(documentId) || !isNonEmptyString(userId)) {
    throw new Error('Document embedding job requires documentId and userId');
  }

  return { documentId, userId };
}
