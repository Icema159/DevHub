import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from './app-error.js';
import { parseSearchInput } from './search-input.js';

test('normalizes a valid search query', () => {
  assert.deepEqual(parseSearchInput({ query: '  How does authentication work?  ' }), {
    query: 'How does authentication work?',
  });
});

test('rejects a missing or non-string query', () => {
  for (const body of [{}, { query: 123 }, null]) {
    assert.throws(
      () => parseSearchInput(body),
      (error) =>
        error instanceof AppError && error.statusCode === 400 && error.code === 'INVALID_INPUT',
    );
  }
});

test('rejects an empty or oversized query', () => {
  for (const query of ['   ', 'a'.repeat(4_001)]) {
    assert.throws(
      () => parseSearchInput({ query }),
      (error) => error instanceof AppError && error.statusCode === 400,
    );
  }
});
