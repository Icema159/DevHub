import assert from 'node:assert/strict';
import test from 'node:test';

import {
  estimateChatReservationMicroUsd,
  estimateEmbeddingReservationMicroUsd,
  estimateUsageMicroUsd,
  UnknownAiModelPricingError,
} from './pricing.js';

test('central pricing rounds non-zero OpenAI costs upward in integer micro-USD', () => {
  assert.equal(
    estimateEmbeddingReservationMicroUsd('openai', 'text-embedding-3-small', ['short']),
    1n,
  );
  assert.equal(
    estimateUsageMicroUsd('openai', 'gpt-5.6-sol', {
      inputTokens: 100,
      cachedInputTokens: 20,
      outputTokens: 10,
    }),
    710n,
  );
  assert.ok(estimateChatReservationMicroUsd('openai', 'gpt-5.6-sol', 'question', 100) > 3_000n);
});

test('unknown production model pricing fails closed', () => {
  assert.throws(
    () => estimateEmbeddingReservationMicroUsd('openai', 'unknown-model', ['content']),
    UnknownAiModelPricingError,
  );
});
