import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDocumentDeletionService,
  type DocumentDeletionDependencies,
} from './document-deletion.service.js';

const deletedAt = new Date('2026-07-22T18:00:00.000Z');
const storedDocument = {
  id: 'document-a',
  userId: 'user-a',
  storageKey: 'users/user-a/documents/document-a.pdf',
  deletedAt,
};
const jobData = {
  documentId: 'document-a',
  userId: 'user-a',
};

function createDependencies(
  overrides: Partial<DocumentDeletionDependencies> = {},
): DocumentDeletionDependencies & { events: string[] } {
  const dependencies = {
    events: [] as string[],
    async findDocument() {
      return storedDocument;
    },
    async deleteFile() {
      dependencies.events.push('storage');
    },
    async deleteDocumentData() {
      dependencies.events.push('database');
      return true;
    },
    ...overrides,
  };

  return dependencies;
}

test('deletes storage before related database data and the document row', async () => {
  const dependencies = createDependencies();
  const service = createDocumentDeletionService(dependencies);

  assert.deepEqual(await service.deleteDocument(jobData), { outcome: 'deleted' });
  assert.deepEqual(dependencies.events, ['storage', 'database']);
});

test('treats an already missing storage object as successful cleanup', async () => {
  const dependencies = createDependencies({
    async deleteFile() {
      dependencies.events.push('storage-missing');
    },
  });
  const service = createDocumentDeletionService(dependencies);

  assert.deepEqual(await service.deleteDocument(jobData), { outcome: 'deleted' });
  assert.deepEqual(dependencies.events, ['storage-missing', 'database']);
});

test('finishes safely when the document no longer exists', async () => {
  const dependencies = createDependencies({
    async findDocument() {
      return null;
    },
  });
  const service = createDocumentDeletionService(dependencies);

  assert.deepEqual(await service.deleteDocument(jobData), { outcome: 'already-missing' });
  assert.deepEqual(dependencies.events, []);
});

test('throws cleanup failures before database deletion so BullMQ can retry', async () => {
  const dependencies = createDependencies({
    async deleteFile() {
      throw new Error('safe storage cleanup failure');
    },
  });
  const service = createDocumentDeletionService(dependencies);

  await assert.rejects(() => service.deleteDocument(jobData), /safe storage cleanup failure/);
  assert.deepEqual(dependencies.events, []);
});

test('retries safely after storage deletion succeeds but database cleanup fails', async () => {
  let databaseAttempts = 0;
  let documentExists = true;
  const dependencies = createDependencies({
    async findDocument() {
      return documentExists ? storedDocument : null;
    },
    async deleteDocumentData() {
      databaseAttempts += 1;
      dependencies.events.push('database');

      if (databaseAttempts === 1) {
        throw new Error('temporary database failure');
      }

      documentExists = false;
      return true;
    },
  });
  const service = createDocumentDeletionService(dependencies);

  await assert.rejects(() => service.deleteDocument(jobData), /temporary database failure/);
  assert.deepEqual(await service.deleteDocument(jobData), { outcome: 'deleted' });
  assert.deepEqual(await service.deleteDocument(jobData), { outcome: 'already-missing' });
  assert.deepEqual(dependencies.events, ['storage', 'database', 'storage', 'database']);
});
