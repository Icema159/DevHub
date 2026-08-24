import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DOCUMENT_DELETION_JOB_NAME,
  type DocumentDeletionJobData,
} from '@developer-knowledge-hub/shared/queue/document-deletion';
import type { Job } from 'bullmq';

import { createDocumentDeletionProcessor } from './document-deletion.worker.js';

function deletionJob(): Job<DocumentDeletionJobData, void, string> {
  return {
    id: 'deletion-job-a',
    name: DOCUMENT_DELETION_JOB_NAME,
    data: { documentId: 'document-a', userId: 'user-a' },
  } as Job<DocumentDeletionJobData, void, string>;
}

test('cleanup processor completes safely for a missing document', async () => {
  const processor = createDocumentDeletionProcessor({
    async deleteDocument() {
      return { outcome: 'already-missing' } as const;
    },
  });

  await processor(deletionJob());
});

test('cleanup processor rethrows service errors for BullMQ retry handling', async () => {
  const expectedError = new Error('cleanup failed');
  const processor = createDocumentDeletionProcessor({
    async deleteDocument() {
      throw expectedError;
    },
  });

  await assert.rejects(
    () => processor(deletionJob()),
    (error) => error === expectedError,
  );
});
