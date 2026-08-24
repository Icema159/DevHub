import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  type GeneratedEmbedding,
} from '@developer-knowledge-hub/ai/embedding';

import type { RetrievedChunk, VectorSearchInput } from '../repositories/vector.repository.js';
import { AppError } from '../utils/app-error.js';
import { createRetrievalService, type RetrievalDependencies } from './retrieval.service.js';

function questionEmbedding(): GeneratedEmbedding {
  return {
    vector: Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1),
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
  };
}

function dependencies(overrides: Partial<RetrievalDependencies> = {}): RetrievalDependencies {
  return {
    async generateQuestionEmbedding() {
      return questionEmbedding();
    },
    async searchChunks() {
      return [];
    },
    ...overrides,
  };
}

test('returns relevant chunks in repository ranking order with the default limit', async () => {
  const rankedResults: RetrievedChunk[] = [
    {
      chunkId: 'chunk-a',
      content: 'JWTs identify the signed-in user.',
      documentId: 'document-a',
      documentName: 'Authentication.pdf',
      chunkPosition: 0,
      page: 1,
      similarity: 0.97,
    },
    {
      chunkId: 'chunk-b',
      content: 'Cookies transport the access token.',
      documentId: 'document-b',
      documentName: 'Sessions.pdf',
      chunkPosition: 2,
      page: 3,
      similarity: 0.82,
    },
  ];
  let receivedInput: VectorSearchInput | undefined;
  const service = createRetrievalService(
    dependencies({
      async searchChunks(input) {
        receivedInput = input;
        return rankedResults;
      },
    }),
  );

  const results = await service.search('user-a', 'How does authentication work?');

  assert.deepEqual(results, rankedResults);
  assert.equal(receivedInput?.userId, 'user-a');
  assert.equal(receivedInput?.embeddingModel, EMBEDDING_MODEL);
  assert.equal(receivedInput?.embeddingDimensions, EMBEDDING_DIMENSIONS);
  assert.equal(receivedInput?.limit, 5);
});

test('keeps retrieval isolated to the authenticated user context', async () => {
  const storedChunks = [
    {
      userId: 'user-a',
      chunkId: 'chunk-a',
      content: 'A private chunk',
      documentId: 'document-a',
      documentName: 'A.pdf',
      chunkPosition: 0,
      page: 1,
      similarity: 0.95,
    },
    {
      userId: 'user-b',
      chunkId: 'chunk-b',
      content: 'B private chunk',
      documentId: 'document-b',
      documentName: 'B.pdf',
      chunkPosition: 0,
      page: 1,
      similarity: 0.99,
    },
  ];
  const service = createRetrievalService(
    dependencies({
      async searchChunks(input) {
        return storedChunks
          .filter((chunk) => chunk.userId === input.userId)
          .map(
            ({ chunkId, content, documentId, documentName, chunkPosition, page, similarity }) => ({
              chunkId,
              content,
              documentId,
              documentName,
              chunkPosition,
              page,
              similarity,
            }),
          );
      },
    }),
  );

  const results = await service.search('user-a', 'private information');

  assert.deepEqual(results, [
    {
      chunkId: 'chunk-a',
      content: 'A private chunk',
      documentId: 'document-a',
      documentName: 'A.pdf',
      chunkPosition: 0,
      page: 1,
      similarity: 0.95,
    },
  ]);
});

test('returns an empty result set when no authorized chunks match', async () => {
  const service = createRetrievalService(dependencies());

  assert.deepEqual(await service.search('user-a', 'unknown topic'), []);
});

test('maps embedding provider failures to a safe service error', async () => {
  let repositoryCalled = false;
  const service = createRetrievalService(
    dependencies({
      async generateQuestionEmbedding() {
        throw new Error('provider secret or transport details');
      },
      async searchChunks() {
        repositoryCalled = true;
        return [];
      },
    }),
  );

  await assert.rejects(
    () => service.search('user-a', 'question'),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 503 &&
      error.code === 'EMBEDDING_PROVIDER_UNAVAILABLE' &&
      !error.message.includes('secret'),
  );
  assert.equal(repositoryCalled, false);
});
