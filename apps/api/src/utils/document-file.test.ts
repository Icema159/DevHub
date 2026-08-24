import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from './app-error.js';
import { calculateFileHash, validateDocumentName, validatePdfContent } from './document-file.js';

test('accepts PDF content and produces a lowercase SHA-256 hex hash', () => {
  const content = Buffer.from('%PDF-1.4\nfoundation');

  assert.doesNotThrow(() => validatePdfContent(content));
  assert.match(calculateFileHash(content), /^[0-9a-f]{64}$/);
});

test('rejects content without a PDF signature', () => {
  assert.throws(
    () => validatePdfContent(Buffer.from('not a PDF')),
    (error) => error instanceof AppError && error.statusCode === 415,
  );
});

test('normalizes a document name without retaining a client path', () => {
  assert.equal(validateDocumentName('/client/path/guide.pdf'), 'guide.pdf');
});
