import assert from 'node:assert/strict';
import test from 'node:test';

import { DocumentChunkingService, TOKEN_COUNT_METHOD } from './document-chunking.service.js';
import { NonRetryableDocumentProcessingError } from './document-processing.error.js';

test('creates deterministic ordered chunks without empty content', () => {
  const service = new DocumentChunkingService(24);
  const pages = [
    { pageNumber: 1, text: '  First   page paragraph with words.  ' },
    { pageNumber: 2, text: '\n\nSecond page.\n' },
  ];

  const firstResult = service.chunkPages(pages);
  const secondResult = service.chunkPages(pages);

  assert.deepEqual(firstResult, secondResult);
  assert.deepEqual(
    firstResult.map((chunk) => chunk.position),
    [0, 1, 2],
  );
  assert.ok(firstResult.every((chunk) => chunk.content.length > 0));
  assert.ok(firstResult.every((chunk) => chunk.content.length <= 24));
  assert.deepEqual(
    firstResult.map((chunk) => chunk.metadata.pageNumber),
    [1, 1, 2],
  );
  assert.ok(firstResult.every((chunk) => chunk.metadata.tokenCountMethod === TOKEN_COUNT_METHOD));
});

test('skips empty pages and splits an overlong word at the configured limit', () => {
  const service = new DocumentChunkingService(5);
  const chunks = service.chunkPages([
    { pageNumber: 1, text: '   ' },
    { pageNumber: 2, text: 'abcdefgh' },
  ]);

  assert.deepEqual(
    chunks.map((chunk) => chunk.content),
    ['abcde', 'fgh'],
  );
  assert.deepEqual(
    chunks.map((chunk) => chunk.position),
    [0, 1],
  );
  assert.ok(chunks.every((chunk) => chunk.tokenCount > 0));
});

test('rejects a document before creating more than the configured chunk limit', () => {
  const service = new DocumentChunkingService(5, 1);

  assert.throws(
    () => service.chunkPages([{ pageNumber: 1, text: 'abcdefgh' }]),
    (error) =>
      error instanceof NonRetryableDocumentProcessingError &&
      error.code === 'PDF_CHUNK_LIMIT_EXCEEDED',
  );
});
