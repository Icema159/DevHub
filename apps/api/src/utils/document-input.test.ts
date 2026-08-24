import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from './app-error.js';
import { parseDocumentId, parseDocumentListQuery } from './document-input.js';

test('accepts an application document ID', () => {
  assert.equal(parseDocumentId('cm123_abc-def'), 'cm123_abc-def');
});

test('rejects an invalid document ID', () => {
  for (const value of ['', 'contains spaces', '../private', 123]) {
    assert.throws(
      () => parseDocumentId(value),
      (error) =>
        error instanceof AppError && error.statusCode === 400 && error.code === 'INVALID_INPUT',
    );
  }
});

test('applies document list query defaults', () => {
  assert.deepEqual(parseDocumentListQuery({}), {
    page: 1,
    limit: 10,
    search: undefined,
    status: 'ALL',
  });
});

test('normalizes document list search and accepts supported filters', () => {
  assert.deepEqual(
    parseDocumentListQuery({
      page: '2',
      limit: '25',
      search: '  Authentication  ',
      status: 'PROCESSING',
    }),
    {
      page: 2,
      limit: 25,
      search: 'Authentication',
      status: 'PROCESSING',
    },
  );
  assert.equal(parseDocumentListQuery({ search: '   ' }).search, undefined);
});

test('rejects invalid document list pagination and status values', () => {
  for (const query of [
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { limit: '0' },
    { limit: '101' },
    { limit: 'ten' },
    { status: 'ready' },
    { status: 'UNKNOWN' },
  ]) {
    assert.throws(
      () => parseDocumentListQuery(query),
      (error) =>
        error instanceof AppError && error.statusCode === 400 && error.code === 'INVALID_INPUT',
    );
  }
});
