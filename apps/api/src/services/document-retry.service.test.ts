import assert from 'node:assert/strict';
import test from 'node:test';

import { DocumentStatus } from '../../../../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import {
  createDocumentRetryService,
  type DocumentRetryDependencies,
} from './document-retry.service.js';

const retryStartedAt = new Date('2026-07-23T10:00:00.000Z');
const previousProcessedAt = new Date('2026-07-22T10:00:00.000Z');
const restartedDocument = {
  id: 'document-a',
  name: 'Authentication Guide.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1_887_436n,
  status: DocumentStatus.PROCESSING,
  processingError: null,
  processedAt: null,
  createdAt: new Date('2026-07-20T11:15:00.000Z'),
  updatedAt: retryStartedAt,
};

function createDependencies(
  overrides: Partial<DocumentRetryDependencies> = {},
): DocumentRetryDependencies & {
  enqueued: Array<{
    data: { documentId: string; userId: string };
    options: { jobId?: string };
  }>;
  restored: Array<{
    documentId: string;
    userId: string;
    retryStartedAt: Date;
    processingError: string | null;
    processedAt: Date | null;
  }>;
} {
  const dependencies = {
    enqueued: [] as Array<{
      data: { documentId: string; userId: string };
      options: { jobId?: string };
    }>,
    restored: [] as Array<{
      documentId: string;
      userId: string;
      retryStartedAt: Date;
      processingError: string | null;
      processedAt: Date | null;
    }>,
    async restart() {
      return {
        outcome: 'restarted' as const,
        document: restartedDocument,
        previousProcessingError: 'Document embedding generation failed',
        previousProcessedAt,
        retryStartedAt,
      };
    },
    async restoreAfterQueueFailure(
      documentId: string,
      userId: string,
      timestamp: Date,
      processingError: string | null,
      processedAt: Date | null,
    ) {
      dependencies.restored.push({
        documentId,
        userId,
        retryStartedAt: timestamp,
        processingError,
        processedAt,
      });
      return true;
    },
    async enqueue(data: { documentId: string; userId: string }, options: { jobId?: string }) {
      dependencies.enqueued.push({ data, options });
    },
    now() {
      return retryStartedAt;
    },
    createJobId() {
      return 'manual-retry-document-a-test';
    },
    ...overrides,
  };

  return dependencies;
}

test('restarts a FAILED document and enqueues identifier-only processing work', async () => {
  const dependencies = createDependencies();
  const service = createDocumentRetryService(dependencies);

  assert.deepEqual(await service.retryDocument('document-a', 'user-a'), {
    id: 'document-a',
    filename: 'Authentication Guide.pdf',
    mimeType: 'application/pdf',
    size: 1_887_436,
    processingState: DocumentStatus.PROCESSING,
    processingError: null,
    createdAt: restartedDocument.createdAt,
    updatedAt: retryStartedAt,
    processedAt: null,
  });
  assert.deepEqual(dependencies.enqueued, [
    {
      data: { documentId: 'document-a', userId: 'user-a' },
      options: { jobId: 'manual-retry-document-a-test' },
    },
  ]);
  assert.deepEqual(dependencies.restored, []);
});

test('maps missing owner-scoped documents to the shared not-found contract', async () => {
  const service = createDocumentRetryService(
    createDependencies({
      async restart() {
        return { outcome: 'not-found' };
      },
    }),
  );

  await assert.rejects(
    () => service.retryDocument('document-a', 'user-a'),
    (error) =>
      error instanceof AppError && error.statusCode === 404 && error.code === 'DOCUMENT_NOT_FOUND',
  );
});

test('rejects every active state other than FAILED', async () => {
  for (const status of [
    DocumentStatus.PENDING,
    DocumentStatus.PROCESSING,
    DocumentStatus.CHUNKS_READY,
    DocumentStatus.EMBEDDING,
    DocumentStatus.READY,
  ]) {
    const service = createDocumentRetryService(
      createDependencies({
        async restart() {
          return { outcome: 'invalid-state', status };
        },
      }),
    );

    await assert.rejects(
      () => service.retryDocument('document-a', 'user-a'),
      (error) =>
        error instanceof AppError &&
        error.statusCode === 409 &&
        error.code === 'INVALID_DOCUMENT_STATE',
    );
  }
});

test('restores FAILED state metadata when processing enqueue fails', async () => {
  const dependencies = createDependencies({
    async enqueue() {
      throw new Error('Redis unavailable');
    },
  });
  const service = createDocumentRetryService(dependencies);

  await assert.rejects(
    () => service.retryDocument('document-a', 'user-a'),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 503 &&
      error.code === 'PROCESSING_QUEUE_UNAVAILABLE',
  );
  assert.deepEqual(dependencies.restored, [
    {
      documentId: 'document-a',
      userId: 'user-a',
      retryStartedAt,
      processingError: 'Document embedding generation failed',
      processedAt: previousProcessedAt,
    },
  ]);
});
