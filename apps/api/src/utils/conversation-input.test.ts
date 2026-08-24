import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from './app-error.js';
import {
  parseConversationId,
  parseConversationListQuery,
  parseConversationMessageContent,
} from './conversation-input.js';

test('accepts an application conversation ID', () => {
  assert.equal(parseConversationId('cm123_abc-def'), 'cm123_abc-def');
});

test('rejects an invalid conversation ID', () => {
  for (const value of ['', 'contains spaces', '../private', 123]) {
    assert.throws(
      () => parseConversationId(value),
      (error) => error instanceof AppError && error.statusCode === 400,
    );
  }
});

test('normalizes valid conversation message content', () => {
  assert.equal(
    parseConversationMessageContent({ content: '  How does authentication work?  ' }),
    'How does authentication work?',
  );
});

test('rejects invalid conversation message content', () => {
  for (const body of [{}, { content: '  ' }, { content: 123 }, { content: 'a'.repeat(4_001) }]) {
    assert.throws(
      () => parseConversationMessageContent(body),
      (error) => error instanceof AppError && error.statusCode === 400,
    );
  }
});

test('applies conversation list pagination defaults', () => {
  assert.deepEqual(parseConversationListQuery({}), {
    page: 1,
    limit: 20,
  });
});

test('accepts supported conversation list pagination', () => {
  assert.deepEqual(parseConversationListQuery({ page: '2', limit: '50' }), {
    page: 2,
    limit: 50,
  });
});

test('rejects invalid conversation list pagination', () => {
  for (const query of [
    { page: '0' },
    { page: 'one' },
    { page: ['1', '2'] },
    { limit: '0' },
    { limit: '101' },
    { limit: '1.5' },
  ]) {
    assert.throws(
      () => parseConversationListQuery(query),
      (error) =>
        error instanceof AppError && error.statusCode === 400 && error.code === 'INVALID_INPUT',
    );
  }
});
