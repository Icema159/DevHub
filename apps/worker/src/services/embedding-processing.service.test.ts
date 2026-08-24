import assert from 'node:assert/strict';
import test from 'node:test';

import { DocumentStatus } from '../../../../generated/prisma/client.js';
import type { ChunkEmbeddingWrite, EmbeddingChunk } from '../repositories/embedding.repository.js';
import {
  createEmbeddingProcessingService,
  EmbeddingProcessingRejectedError,
  type EmbeddingProcessingDependencies,
} from './embedding-processing.service.js';
import { WorkerAiBudgetUnavailableError } from './ai-budget.service.js';

const model = 'text-embedding-3-small';
const dimensions = 1536;

const storedDocument = {
  id: 'document-a',
  userId: 'user-a',
  status: DocumentStatus.CHUNKS_READY,
  deletedAt: null,
};

const chunks: EmbeddingChunk[] = [
  {
    id: 'chunk-a',
    documentId: 'document-a',
    position: 0,
    content: 'First chunk',
    embeddingModel: null,
    embeddingDimensions: null,
    hasEmbedding: false,
  },
  {
    id: 'chunk-b',
    documentId: 'document-a',
    position: 1,
    content: 'Second chunk',
    embeddingModel: null,
    embeddingDimensions: null,
    hasEmbedding: false,
  },
];

function createDependencies(
  overrides: Partial<EmbeddingProcessingDependencies> = {},
): EmbeddingProcessingDependencies & {
  transitionCalls: number;
  findChunkCalls: number;
  generateCalls: string[][];
  completedWrites: ChunkEmbeddingWrite[][];
  failedMessages: string[];
} {
  const dependencies = {
    model,
    dimensions,
    transitionCalls: 0,
    findChunkCalls: 0,
    generateCalls: [] as string[][],
    completedWrites: [] as ChunkEmbeddingWrite[][],
    failedMessages: [] as string[],
    async findDocument() {
      return storedDocument;
    },
    async transitionToEmbedding() {
      dependencies.transitionCalls += 1;
      return true;
    },
    async findChunks() {
      dependencies.findChunkCalls += 1;
      return chunks;
    },
    async prepareEmbeddings(_userId: string, texts: string[]) {
      dependencies.generateCalls.push(texts);
      return {
        async generate() {
          return texts.map((_text, index) => ({
            vector: Array.from({ length: dimensions }, () => index / 10),
            model,
            dimensions,
          }));
        },
        async release() {},
      };
    },
    async completeEmbedding(_documentId: string, _userId: string, writes: ChunkEmbeddingWrite[]) {
      dependencies.completedWrites.push(writes);
      return true;
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

test('generates chunk embeddings and passes vector metadata for persistence', async () => {
  const dependencies = createDependencies();
  const service = createEmbeddingProcessingService(dependencies);

  assert.deepEqual(await service.processDocumentEmbeddings(jobData), {
    outcome: 'ready',
    embeddedChunkCount: 2,
  });
  assert.equal(dependencies.transitionCalls, 1);
  assert.deepEqual(dependencies.generateCalls, [['First chunk', 'Second chunk']]);
  assert.equal(dependencies.completedWrites[0]?.length, 2);
  assert.ok(
    dependencies.completedWrites[0]?.every(
      (write) => write.model === model && write.dimensions === dimensions,
    ),
  );
});

test('does not regenerate embeddings that already match model and dimensions', async () => {
  const dependencies = createDependencies({
    async findDocument() {
      return { ...storedDocument, status: DocumentStatus.EMBEDDING };
    },
    async findChunks() {
      return chunks.map((chunk) => ({
        ...chunk,
        embeddingModel: model,
        embeddingDimensions: dimensions,
        hasEmbedding: true,
      }));
    },
  });
  const service = createEmbeddingProcessingService(dependencies);

  assert.deepEqual(await service.processDocumentEmbeddings(jobData), {
    outcome: 'ready',
    embeddedChunkCount: 0,
  });
  assert.deepEqual(dependencies.generateCalls, []);
  assert.deepEqual(dependencies.completedWrites, [[]]);
});

test('treats a READY document as an idempotent success', async () => {
  const dependencies = createDependencies({
    async findDocument() {
      return { ...storedDocument, status: DocumentStatus.READY };
    },
  });
  const service = createEmbeddingProcessingService(dependencies);

  assert.deepEqual(await service.processDocumentEmbeddings(jobData), {
    outcome: 'already-ready',
    embeddedChunkCount: 0,
  });
  assert.deepEqual(dependencies.generateCalls, []);
  assert.deepEqual(dependencies.completedWrites, []);
});

test('stops safely when an embedding job encounters a soft-deleted document', async () => {
  const dependencies = createDependencies({
    async findDocument() {
      return { ...storedDocument, status: DocumentStatus.EMBEDDING, deletedAt: new Date() };
    },
  });
  const service = createEmbeddingProcessingService(dependencies);

  assert.deepEqual(await service.processDocumentEmbeddings(jobData), {
    outcome: 'deleted',
    embeddedChunkCount: 0,
  });
  assert.deepEqual(dependencies.generateCalls, []);
  assert.deepEqual(dependencies.completedWrites, []);
});

test('rejects a forged owner payload before reading chunks or calling the provider', async () => {
  const dependencies = createDependencies({
    async findDocument() {
      return { ...storedDocument, userId: 'user-b' };
    },
  });
  const service = createEmbeddingProcessingService(dependencies);

  await assert.rejects(
    () => service.processDocumentEmbeddings(jobData),
    (error) =>
      error instanceof EmbeddingProcessingRejectedError && error.code === 'DOCUMENT_OWNER_MISMATCH',
  );
  assert.equal(dependencies.transitionCalls, 0);
  assert.equal(dependencies.findChunkCalls, 0);
  assert.deepEqual(dependencies.generateCalls, []);
  assert.deepEqual(dependencies.completedWrites, []);
  assert.deepEqual(dependencies.failedMessages, []);
});

test('does not persist provider failures when deletion races with embedding generation', async () => {
  let findCalls = 0;
  const dependencies = createDependencies({
    async findDocument() {
      findCalls += 1;
      return findCalls === 1
        ? { ...storedDocument, status: DocumentStatus.EMBEDDING }
        : { ...storedDocument, status: DocumentStatus.EMBEDDING, deletedAt: new Date() };
    },
    async prepareEmbeddings() {
      return {
        async generate() {
          throw new Error('provider request interrupted');
        },
        async release() {},
      };
    },
  });
  const service = createEmbeddingProcessingService(dependencies);

  assert.deepEqual(await service.processDocumentEmbeddings(jobData), {
    outcome: 'deleted',
    embeddedChunkCount: 0,
  });
  assert.deepEqual(dependencies.completedWrites, []);
  assert.deepEqual(dependencies.failedMessages, []);
});

test('stores the fixed safe error only when the worker records a final embedding failure', async () => {
  const dependencies = createDependencies({
    async prepareEmbeddings() {
      return {
        async generate() {
          throw new Error('provider response with internal details');
        },
        async release() {},
      };
    },
  });
  const service = createEmbeddingProcessingService(dependencies);

  await assert.rejects(() => service.processDocumentEmbeddings(jobData));
  assert.deepEqual(dependencies.failedMessages, []);

  await service.recordFinalFailure(jobData);
  assert.deepEqual(dependencies.failedMessages, ['Document embedding generation failed']);
});

test('budget exhaustion defers before EMBEDDING transition or provider work', async () => {
  const retryAt = new Date(Date.now() + 60_000);
  const dependencies = createDependencies({
    async prepareEmbeddings() {
      throw new WorkerAiBudgetUnavailableError(retryAt);
    },
  });
  const service = createEmbeddingProcessingService(dependencies);

  await assert.rejects(
    () => service.processDocumentEmbeddings(jobData),
    (error) => error instanceof WorkerAiBudgetUnavailableError && error.retryAt === retryAt,
  );
  assert.equal(dependencies.transitionCalls, 0);
  assert.deepEqual(dependencies.completedWrites, []);
  assert.deepEqual(dependencies.failedMessages, []);
});
