import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DOCUMENT_EMBEDDING_JOB_NAME,
  type DocumentEmbeddingJobData,
} from '@developer-knowledge-hub/shared/queue/document-embedding';
import {
  DOCUMENT_PROCESSING_JOB_NAME,
  type DocumentProcessingJobData,
} from '@developer-knowledge-hub/shared/queue/document-processing';
import type { Job } from 'bullmq';

import { NonRetryableDocumentProcessingError } from '../services/document-processing.error.js';
import { PdfContainmentError } from '../services/pdf-containment.error.js';
import { WorkerAiBudgetUnavailableError } from '../services/ai-budget.service.js';
import { createDocumentEmbeddingProcessor } from './document-embedding.worker.js';
import { createDocumentProcessingProcessor } from './document-processing.worker.js';

const jobData = {
  documentId: 'document-a',
  userId: 'user-a',
};

function processingJob(
  attemptsMade: number,
  attempts: number,
): Job<DocumentProcessingJobData, void, string> {
  return {
    id: 'processing-job-a',
    name: DOCUMENT_PROCESSING_JOB_NAME,
    data: jobData,
    attemptsMade,
    opts: { attempts },
  } as Job<DocumentProcessingJobData, void, string>;
}

function embeddingJob(
  attemptsMade: number,
  attempts: number,
): Job<DocumentEmbeddingJobData, void, string> {
  return {
    id: 'embedding-job-a',
    name: DOCUMENT_EMBEDDING_JOB_NAME,
    data: jobData,
    attemptsMade,
    opts: { attempts },
  } as Job<DocumentEmbeddingJobData, void, string>;
}

test('document.process throws an early failure without recording FAILED', async () => {
  const state = {
    status: 'PROCESSING',
    processingError: null as string | null,
    processedAt: null as Date | null,
  };
  let finalFailureCalls = 0;
  const processor = createDocumentProcessingProcessor({
    async processDocument() {
      throw new Error('temporary storage outage');
    },
    async recordFinalFailure() {
      finalFailureCalls += 1;
      state.status = 'FAILED';
      state.processingError = 'safe error';
    },
  });

  await assert.rejects(() => processor(processingJob(0, 3)), /temporary storage outage/);
  assert.equal(finalFailureCalls, 0);
  assert.deepEqual(state, {
    status: 'PROCESSING',
    processingError: null,
    processedAt: null,
  });
});

test('document processing can succeed after a failure and continue through embedding to READY', async () => {
  const state = {
    status: 'PROCESSING',
    processingError: null as string | null,
    processedAt: null as Date | null,
  };
  let processingCalls = 0;
  const processingProcessor = createDocumentProcessingProcessor({
    async processDocument() {
      processingCalls += 1;

      if (processingCalls === 1) {
        throw new Error('temporary storage outage');
      }

      state.status = 'CHUNKS_READY';
      state.processingError = null;
      return { outcome: 'embedding-queued', chunkCount: 1 } as const;
    },
    async recordFinalFailure() {
      state.status = 'FAILED';
      state.processingError = 'safe error';
    },
  });
  const embeddingProcessor = createDocumentEmbeddingProcessor({
    async processDocumentEmbeddings() {
      state.status = 'READY';
      state.processingError = null;
      state.processedAt = new Date('2026-07-22T12:00:00.000Z');
      return { outcome: 'ready', embeddedChunkCount: 1 } as const;
    },
    async recordFinalFailure() {
      state.status = 'FAILED';
      state.processingError = 'Document embedding generation failed';
    },
  });

  await assert.rejects(() => processingProcessor(processingJob(0, 3)));
  await processingProcessor(processingJob(1, 3));
  assert.equal(state.status, 'CHUNKS_READY');
  await embeddingProcessor(embeddingJob(0, 3));

  assert.equal(state.status, 'READY');
  assert.equal(state.processingError, null);
  assert.deepEqual(state.processedAt, new Date('2026-07-22T12:00:00.000Z'));
});

test('document.process records a safe final failure on its last configured attempt', async () => {
  const state = {
    status: 'PROCESSING',
    processingError: null as string | null,
    processedAt: null as Date | null,
  };
  const processor = createDocumentProcessingProcessor({
    async processDocument() {
      throw new Error('private filesystem path');
    },
    async recordFinalFailure(_data, error) {
      assert.match(String(error), /private filesystem path/);
      state.status = 'FAILED';
      state.processingError = 'Document processing failed during file retrieval or text extraction';
      state.processedAt = null;
    },
  });

  await assert.rejects(() => processor(processingJob(2, 3)));
  assert.deepEqual(state, {
    status: 'FAILED',
    processingError: 'Document processing failed during file retrieval or text extraction',
    processedAt: null,
  });
});

test('document.process with one attempt records failure on its first error', async () => {
  let finalFailureCalls = 0;
  const processor = createDocumentProcessingProcessor({
    async processDocument() {
      throw new Error('temporary storage outage');
    },
    async recordFinalFailure() {
      finalFailureCalls += 1;
    },
  });

  await assert.rejects(() => processor(processingJob(0, 1)));
  assert.equal(finalFailureCalls, 1);
});

test('document.process records explicitly unrecoverable failures immediately', async () => {
  let finalFailureCalls = 0;
  const processor = createDocumentProcessingProcessor({
    async processDocument() {
      throw new NonRetryableDocumentProcessingError(
        'PDF_TEXT_NOT_FOUND',
        'The PDF does not contain extractable text',
      );
    },
    async recordFinalFailure() {
      finalFailureCalls += 1;
    },
  });

  await assert.rejects(() => processor(processingJob(0, 3)), { name: 'UnrecoverableError' });
  assert.equal(finalFailureCalls, 1);
});

test('document.process prevents retries for a typed PDF containment failure', async () => {
  let finalFailureCalls = 0;
  const processor = createDocumentProcessingProcessor({
    async processDocument() {
      throw new PdfContainmentError('PDF_PROCESSING_TIMEOUT', 'The PDF took too long to process');
    },
    async recordFinalFailure(_jobData, error) {
      assert.ok(error instanceof PdfContainmentError);
      finalFailureCalls += 1;
    },
  });

  await assert.rejects(() => processor(processingJob(0, 3)), {
    name: 'UnrecoverableError',
    message: 'PDF_PROCESSING_TIMEOUT: The PDF took too long to process',
  });
  assert.equal(finalFailureCalls, 1);
});

test('document.embed throws an early failure and keeps the document active', async () => {
  const state = {
    status: 'EMBEDDING',
    processingError: null as string | null,
  };
  let finalFailureCalls = 0;
  const processor = createDocumentEmbeddingProcessor({
    async processDocumentEmbeddings() {
      throw new Error('temporary provider outage');
    },
    async recordFinalFailure() {
      finalFailureCalls += 1;
      state.status = 'FAILED';
      state.processingError = 'Document embedding generation failed';
    },
  });

  await assert.rejects(() => processor(embeddingJob(0, 3)), /temporary provider outage/);
  assert.equal(finalFailureCalls, 0);
  assert.deepEqual(state, {
    status: 'EMBEDDING',
    processingError: null,
  });
});

test('document.embed moves budget-blocked work to delayed without recording FAILED', async () => {
  let delayedUntil: number | undefined;
  let finalFailureCalls = 0;
  const retryAt = new Date(Date.now() + 120_000);
  const processor = createDocumentEmbeddingProcessor({
    async processDocumentEmbeddings() {
      throw new WorkerAiBudgetUnavailableError(retryAt);
    },
    async recordFinalFailure() {
      finalFailureCalls += 1;
    },
  });
  const job = embeddingJob(2, 3);
  job.token = 'worker-token';
  job.moveToDelayed = async (timestamp) => {
    delayedUntil = timestamp;
  };

  await assert.rejects(() => processor(job), { name: 'DelayedError' });
  assert.equal(delayedUntil, retryAt.getTime());
  assert.equal(finalFailureCalls, 0);
});

test('document.embed can succeed on retry and clears stale failure data', async () => {
  const state = {
    status: 'EMBEDDING',
    processingError: null as string | null,
    processedAt: null as Date | null,
  };
  let calls = 0;
  const processor = createDocumentEmbeddingProcessor({
    async processDocumentEmbeddings() {
      calls += 1;

      if (calls === 1) {
        throw new Error('temporary provider outage');
      }

      state.status = 'READY';
      state.processingError = null;
      state.processedAt = new Date('2026-07-22T12:00:00.000Z');
      return { outcome: 'ready', embeddedChunkCount: 1 } as const;
    },
    async recordFinalFailure() {
      state.status = 'FAILED';
      state.processingError = 'Document embedding generation failed';
    },
  });

  await assert.rejects(() => processor(embeddingJob(0, 3)));
  await processor(embeddingJob(1, 3));

  assert.equal(state.status, 'READY');
  assert.equal(state.processingError, null);
  assert.deepEqual(state.processedAt, new Date('2026-07-22T12:00:00.000Z'));
});

test('document.embed records its fixed safe error on the final attempt', async () => {
  const state = {
    status: 'EMBEDDING',
    processingError: null as string | null,
    processedAt: null as Date | null,
  };
  const processor = createDocumentEmbeddingProcessor({
    async processDocumentEmbeddings() {
      throw new Error('raw provider response');
    },
    async recordFinalFailure() {
      state.status = 'FAILED';
      state.processingError = 'Document embedding generation failed';
      state.processedAt = null;
    },
  });

  await assert.rejects(() => processor(embeddingJob(2, 3)));
  assert.deepEqual(state, {
    status: 'FAILED',
    processingError: 'Document embedding generation failed',
    processedAt: null,
  });
});

test('document.embed with one attempt records failure on its first error', async () => {
  let finalFailureCalls = 0;
  const processor = createDocumentEmbeddingProcessor({
    async processDocumentEmbeddings() {
      throw new Error('temporary provider outage');
    },
    async recordFinalFailure() {
      finalFailureCalls += 1;
    },
  });

  await assert.rejects(() => processor(embeddingJob(0, 1)));
  assert.equal(finalFailureCalls, 1);
});
