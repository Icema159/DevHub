import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EmbeddingService,
  type EmbeddingProvider,
  type GenerateEmbeddingsInput,
} from './embedding.service.js';

function vector(dimensions: number, value: number): number[] {
  return Array.from({ length: dimensions }, () => value);
}

test('batches provider calls and returns validated model metadata', async () => {
  const calls: GenerateEmbeddingsInput[] = [];
  const provider: EmbeddingProvider = {
    async generateEmbeddings(input) {
      calls.push(input);
      return {
        vectors: input.texts.map((_text, index) => vector(input.dimensions, index / 10)),
      };
    },
  };
  const service = new EmbeddingService(provider, {
    model: 'text-embedding-3-small',
    dimensions: 4,
    batchSize: 2,
  });

  const result = await service.generateEmbeddings(['first', 'second', 'third']);

  assert.equal(calls.length, 2);
  assert.deepEqual(
    calls.map((call) => call.texts),
    [['first', 'second'], ['third']],
  );
  assert.ok(
    result.every(
      (embedding) => embedding.model === 'text-embedding-3-small' && embedding.dimensions === 4,
    ),
  );
});

test('rejects a provider vector with the wrong dimensions', async () => {
  const provider: EmbeddingProvider = {
    async generateEmbeddings() {
      return { vectors: [[0.1, 0.2]] };
    },
  };
  const service = new EmbeddingService(provider, {
    model: 'text-embedding-3-small',
    dimensions: 3,
  });

  await assert.rejects(() => service.generateEmbeddings(['content']), /invalid 3-dimension vector/);
});
