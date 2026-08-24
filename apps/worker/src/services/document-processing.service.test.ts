import assert from 'node:assert/strict';
import test from 'node:test';

import { DocumentStatus } from '../../../../generated/prisma/client.js';
import type { DocumentChunkDraft } from './document-chunking.service.js';
import { NonRetryableDocumentProcessingError } from './document-processing.error.js';
import { ObjectStorageSizeMismatchError } from './object-storage.service.js';
import {
  createDocumentProcessingService,
  DocumentProcessingRejectedError,
  type DocumentProcessingDependencies,
} from './document-processing.service.js';

const storedDocument = {
  id: 'document-a',
  userId: 'user-a',
  storageKey: 'users/user-a/documents/document-a.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 9n,
  status: DocumentStatus.PENDING,
  deletedAt: null,
};

const chunk: DocumentChunkDraft = {
  position: 0,
  content: 'Extracted document text',
  tokenCount: 6,
  metadata: {
    pageNumber: 1,
    characterCount: 23,
    tokenCountMethod: 'character-estimate-v1',
  },
};

function createDependencies(
  overrides: Partial<DocumentProcessingDependencies> = {},
): DocumentProcessingDependencies & {
  transitionCalls: number;
  completeCalls: number;
  enqueueCalls: number;
  failedMessages: string[];
} {
  const dependencies = {
    transitionCalls: 0,
    completeCalls: 0,
    enqueueCalls: 0,
    failedMessages: [] as string[],
    async findDocument() {
      return storedDocument;
    },
    async transitionToProcessing() {
      dependencies.transitionCalls += 1;
      return true;
    },
    async downloadFile() {
      return Buffer.from('%PDF-test');
    },
    async parsePdf() {
      return {
        pageCount: 1,
        pages: [{ pageNumber: 1, text: 'Extracted document text' }],
      };
    },
    chunkPages() {
      return [chunk];
    },
    async completeProcessing() {
      dependencies.completeCalls += 1;
      return true;
    },
    async enqueueEmbedding() {
      dependencies.enqueueCalls += 1;
    },
    async markFailed(_documentId: string, _userId: string, message: string) {
      dependencies.failedMessages.push(message);
      return true;
    },
    ...overrides,
  };

  return dependencies;
}

const jobData = {
  documentId: 'document-a',
  userId: 'user-a',
};

test('processes a PENDING PDF, stores chunks, and creates an embedding job', async () => {
  const dependencies = createDependencies();
  const service = createDocumentProcessingService(dependencies);

  assert.deepEqual(await service.processDocument(jobData), {
    outcome: 'embedding-queued',
    chunkCount: 1,
  });
  assert.equal(dependencies.transitionCalls, 1);
  assert.equal(dependencies.completeCalls, 1);
  assert.equal(dependencies.enqueueCalls, 1);
  assert.deepEqual(dependencies.failedMessages, []);
});

test('continues an already PROCESSING document without another state transition', async () => {
  const dependencies = createDependencies({
    async findDocument() {
      return { ...storedDocument, status: DocumentStatus.PROCESSING };
    },
  });
  const service = createDocumentProcessingService(dependencies);

  assert.equal((await service.processDocument(jobData)).outcome, 'embedding-queued');
  assert.equal(dependencies.transitionCalls, 0);
  assert.equal(dependencies.completeCalls, 1);
  assert.equal(dependencies.enqueueCalls, 1);
});

test('treats an already READY document as an idempotent success', async () => {
  const dependencies = createDependencies({
    async findDocument() {
      return { ...storedDocument, status: DocumentStatus.READY };
    },
  });
  const service = createDocumentProcessingService(dependencies);

  assert.deepEqual(await service.processDocument(jobData), {
    outcome: 'already-ready',
    chunkCount: null,
  });
  assert.equal(dependencies.transitionCalls, 0);
  assert.equal(dependencies.completeCalls, 0);
  assert.equal(dependencies.enqueueCalls, 0);
});

test('stops safely when a processing job encounters a soft-deleted document', async () => {
  const dependencies = createDependencies({
    async findDocument() {
      return { ...storedDocument, status: DocumentStatus.PROCESSING, deletedAt: new Date() };
    },
  });
  const service = createDocumentProcessingService(dependencies);

  assert.deepEqual(await service.processDocument(jobData), {
    outcome: 'deleted',
    chunkCount: null,
  });
  assert.equal(dependencies.completeCalls, 0);
  assert.equal(dependencies.enqueueCalls, 0);
});

test('does not persist chunks when deletion races with file retrieval', async () => {
  let findCalls = 0;
  const dependencies = createDependencies({
    async findDocument() {
      findCalls += 1;
      return findCalls === 1
        ? { ...storedDocument, status: DocumentStatus.PROCESSING }
        : { ...storedDocument, status: DocumentStatus.PROCESSING, deletedAt: new Date() };
    },
    async downloadFile() {
      throw new Error('file disappeared during cleanup');
    },
  });
  const service = createDocumentProcessingService(dependencies);

  assert.deepEqual(await service.processDocument(jobData), {
    outcome: 'deleted',
    chunkCount: null,
  });
  assert.equal(dependencies.completeCalls, 0);
  assert.equal(dependencies.enqueueCalls, 0);
  assert.deepEqual(dependencies.failedMessages, []);
});

test('restarts a FAILED document so a BullMQ retry can process it', async () => {
  const dependencies = createDependencies({
    async findDocument() {
      return { ...storedDocument, status: DocumentStatus.FAILED };
    },
  });
  const service = createDocumentProcessingService(dependencies);

  assert.equal((await service.processDocument(jobData)).outcome, 'embedding-queued');
  assert.equal(dependencies.transitionCalls, 1);
});

test('retries only embedding enqueue when chunks are already ready', async () => {
  const dependencies = createDependencies({
    async findDocument() {
      return { ...storedDocument, status: DocumentStatus.CHUNKS_READY };
    },
  });
  const service = createDocumentProcessingService(dependencies);

  assert.deepEqual(await service.processDocument(jobData), {
    outcome: 'embedding-queued',
    chunkCount: null,
  });
  assert.equal(dependencies.transitionCalls, 0);
  assert.equal(dependencies.completeCalls, 0);
  assert.equal(dependencies.enqueueCalls, 1);
});

test('leaves failure persistence to the worker and preserves a safe permanent error', async () => {
  const dependencies = createDependencies({
    async parsePdf() {
      throw new NonRetryableDocumentProcessingError(
        'PDF_TEXT_NOT_FOUND',
        'The PDF does not contain extractable text',
      );
    },
  });
  const service = createDocumentProcessingService(dependencies);

  await assert.rejects(
    () => service.processDocument(jobData),
    (error) =>
      error instanceof NonRetryableDocumentProcessingError && error.code === 'PDF_TEXT_NOT_FOUND',
  );
  assert.deepEqual(dependencies.failedMessages, []);

  await service.recordFinalFailure(
    jobData,
    new NonRetryableDocumentProcessingError(
      'PDF_TEXT_NOT_FOUND',
      'The PDF does not contain extractable text',
    ),
  );
  assert.deepEqual(dependencies.failedMessages, ['The PDF does not contain extractable text']);
});

test('stores a generic processing error only when the worker records a final failure', async () => {
  const dependencies = createDependencies({
    async downloadFile() {
      throw new Error('internal storage detail');
    },
  });
  const service = createDocumentProcessingService(dependencies);

  await assert.rejects(() => service.processDocument(jobData));
  assert.deepEqual(dependencies.failedMessages, []);

  await service.recordFinalFailure(jobData, new Error('internal storage detail'));
  assert.deepEqual(dependencies.failedMessages, [
    'Document processing failed during file retrieval or text extraction',
  ]);
});

test('rejects a job whose user does not own the document', async () => {
  const service = createDocumentProcessingService(
    createDependencies({
      async findDocument() {
        return { ...storedDocument, userId: 'user-b' };
      },
    }),
  );

  await assert.rejects(
    () => service.processDocument(jobData),
    (error) =>
      error instanceof DocumentProcessingRejectedError && error.code === 'DOCUMENT_OWNER_MISMATCH',
  );
});

test('rejects an invalid stored PDF before parsing, chunk persistence, or embedding enqueue', async () => {
  let parseCalls = 0;
  const dependencies = createDependencies({
    async downloadFile() {
      return Buffer.from('not-a-pdf');
    },
    async parsePdf() {
      parseCalls += 1;
      return { pageCount: 1, pages: [{ pageNumber: 1, text: 'unreachable' }] };
    },
  });
  const service = createDocumentProcessingService(dependencies);

  await assert.rejects(
    () => service.processDocument(jobData),
    (error) =>
      error instanceof NonRetryableDocumentProcessingError &&
      error.code === 'PDF_STORED_FILE_INVALID',
  );
  assert.equal(parseCalls, 0);
  assert.equal(dependencies.completeCalls, 0);
  assert.equal(dependencies.enqueueCalls, 0);
});

test('maps a pre-download storage size mismatch to a non-retryable containment failure', async () => {
  const dependencies = createDependencies({
    async downloadFile() {
      throw new ObjectStorageSizeMismatchError();
    },
  });
  const service = createDocumentProcessingService(dependencies);

  await assert.rejects(
    () => service.processDocument(jobData),
    (error) =>
      error instanceof NonRetryableDocumentProcessingError &&
      error.code === 'PDF_STORED_FILE_INVALID',
  );
  assert.equal(dependencies.completeCalls, 0);
  assert.equal(dependencies.enqueueCalls, 0);
});

test('containment rejection creates no chunks or embedding work and records its safe error', async () => {
  const containmentError = new NonRetryableDocumentProcessingError(
    'PDF_PAGE_LIMIT_EXCEEDED',
    'The PDF exceeds the maximum supported page count of 150',
  );
  const dependencies = createDependencies({
    async parsePdf() {
      throw containmentError;
    },
  });
  const service = createDocumentProcessingService(dependencies);

  await assert.rejects(() => service.processDocument(jobData), containmentError);
  assert.equal(dependencies.completeCalls, 0);
  assert.equal(dependencies.enqueueCalls, 0);

  await service.recordFinalFailure(jobData, containmentError);
  assert.deepEqual(dependencies.failedMessages, [
    'The PDF exceeds the maximum supported page count of 150',
  ]);
});
