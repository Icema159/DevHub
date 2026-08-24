import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../utils/app-error.js';
import {
  createDocumentDeletionService,
  type DocumentDeletionDependencies,
} from './document-deletion.service.js';

const deletedAt = new Date('2026-07-22T18:00:00.000Z');

function createDependencies(
  overrides: Partial<DocumentDeletionDependencies> = {},
): DocumentDeletionDependencies & {
  enqueued: Array<{ documentId: string; userId: string }>;
  restored: Array<{ documentId: string; userId: string; deletedAt: Date }>;
} {
  const dependencies = {
    enqueued: [] as Array<{ documentId: string; userId: string }>,
    restored: [] as Array<{ documentId: string; userId: string; deletedAt: Date }>,
    async softDelete() {
      return { reservationId: 'delete-hold-a' };
    },
    async releaseHold() {},
    async restoreAfterQueueFailure(documentId: string, userId: string, timestamp: Date) {
      dependencies.restored.push({ documentId, userId, deletedAt: timestamp });
      return true;
    },
    async enqueue(data: { documentId: string; userId: string }) {
      dependencies.enqueued.push(data);
    },
    now() {
      return deletedAt;
    },
    ...overrides,
  };

  return dependencies;
}

test('soft deletes an owned document and enqueues identifier-only cleanup work', async () => {
  const dependencies = createDependencies();
  const service = createDocumentDeletionService(dependencies);

  assert.deepEqual(await service.deleteDocument('document-a', 'user-a'), {
    id: 'document-a',
    deletedAt,
  });
  assert.deepEqual(dependencies.enqueued, [{ documentId: 'document-a', userId: 'user-a' }]);
  assert.deepEqual(dependencies.restored, []);
});

test('uses the same not-found error when the owner-scoped soft delete does not match', async () => {
  const service = createDocumentDeletionService(
    createDependencies({
      async softDelete() {
        return null;
      },
    }),
  );

  await assert.rejects(
    () => service.deleteDocument('document-a', 'user-a'),
    (error) =>
      error instanceof AppError && error.statusCode === 404 && error.code === 'DOCUMENT_NOT_FOUND',
  );
});

test('restores the exact soft delete when cleanup enqueue fails', async () => {
  const dependencies = createDependencies({
    async enqueue() {
      throw new Error('Redis unavailable');
    },
  });
  const service = createDocumentDeletionService(dependencies);

  await assert.rejects(
    () => service.deleteDocument('document-a', 'user-a'),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 503 &&
      error.code === 'DOCUMENT_DELETION_QUEUE_UNAVAILABLE',
  );
  assert.deepEqual(dependencies.restored, [
    { documentId: 'document-a', userId: 'user-a', deletedAt },
  ]);
});
