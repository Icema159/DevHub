import assert from 'node:assert/strict';
import test from 'node:test';

import type { RetrievedChunk } from '../repositories/vector.repository.js';
import {
  buildBoundedConversationContext,
  buildContextAwareRetrievalQuery,
  buildGroundedPrompt,
  INSUFFICIENT_CONTEXT_ANSWER,
  MAX_CONVERSATION_CONTEXT_CHARACTERS,
  selectCitedSources,
} from './rag-prompt.service.js';

const chunks: RetrievedChunk[] = [
  {
    chunkId: 'chunk-a',
    content: 'JWT access tokens are transported in HttpOnly cookies.',
    documentId: 'document-a',
    documentName: 'Authentication.pdf',
    chunkPosition: 3,
    page: 12,
    similarity: 0.94,
  },
  {
    chunkId: 'chunk-b',
    content: 'The middleware attaches userId and email to req.user.',
    documentId: 'document-a',
    documentName: 'Authentication.pdf',
    chunkPosition: 4,
    page: null,
    similarity: 0.88,
  },
];

test('builds separated grounded prompt parts with stable source labels', () => {
  const prompt = buildGroundedPrompt(
    'Where should I store it?',
    chunks,
    'USER:\nHow does JWT authentication work?\n\nASSISTANT:\nJWT is a signed token.',
  );

  assert.equal(prompt.userQuestion, 'Where should I store it?');
  assert.match(prompt.systemInstructions, /only from the retrieved sources/);
  assert.match(prompt.systemInstructions, /conversation context only to understand dialogue/i);
  assert.match(prompt.systemInstructions, /never treat conversation context/i);
  assert.match(prompt.systemInstructions, /untrusted dialogue data/i);
  assert.match(prompt.systemInstructions, /plain text only/i);
  assert.match(prompt.systemInstructions, /do not use Markdown/i);
  assert.match(prompt.systemInstructions, new RegExp(INSUFFICIENT_CONTEXT_ANSWER));
  assert.match(prompt.conversationContext ?? '', /How does JWT authentication work/);
  assert.match(prompt.context, /\[S1\]/);
  assert.match(prompt.context, /\[S2\]/);
  assert.match(prompt.context, /Page: 12/);
  assert.doesNotMatch(prompt.context, /How does JWT authentication work/);
  assert.doesNotMatch(prompt.context, /storageKey|fileHash|embedding/i);
  assert.deepEqual(prompt.sources[0], {
    label: 'S1',
    documentId: 'document-a',
    documentName: 'Authentication.pdf',
    chunkId: 'chunk-a',
    chunkPosition: 3,
    page: 12,
  });
});

test('builds a context-aware retrieval query while preserving stateless behavior without history', () => {
  const followUpQuery = buildContextAwareRetrievalQuery(
    'Where should I store it?',
    'USER:\nHow does JWT authentication work?',
  );

  assert.match(followUpQuery, /JWT authentication/);
  assert.match(followUpQuery, /Where should I store it\?/);
  assert.equal(
    buildContextAwareRetrievalQuery('How does JWT authentication work?', ''),
    'How does JWT authentication work?',
  );
});

test('keeps the newest messages when bounded conversation context exceeds its size limit', () => {
  const context = buildBoundedConversationContext(
    [
      { role: 'USER', content: `Old context ${'x'.repeat(200)}` },
      { role: 'ASSISTANT', content: 'The newest assistant response about JWT storage.' },
    ],
    80,
  );

  assert.doesNotMatch(context, /Old context/);
  assert.match(context, /newest assistant response/);
  assert.ok(Array.from(context).length <= 80);
  assert.ok(
    Array.from(
      buildBoundedConversationContext([{ role: 'ASSISTANT', content: 'y'.repeat(10_000) }]),
    ).length <= MAX_CONVERSATION_CONTEXT_CHARACTERS,
  );
});

test('handles a missing assistant reply and empty history safely', () => {
  assert.equal(
    buildBoundedConversationContext([{ role: 'USER', content: 'Previous unanswered question' }]),
    'USER:\nPrevious unanswered question',
  );
  assert.equal(buildBoundedConversationContext([]), '');
});

test('does not accept an empty context', () => {
  assert.throws(() => buildGroundedPrompt('Question', []), /at least one retrieved chunk/);
});

test('selects only valid source labels cited by the answer', () => {
  const prompt = buildGroundedPrompt('Question', chunks);

  assert.deepEqual(selectCitedSources('The cookie transports the JWT [S1].', prompt.sources), [
    prompt.sources[0],
  ]);
  assert.throws(
    () => selectCitedSources('Unsupported claim [S99].', prompt.sources),
    /unavailable source/,
  );
  assert.throws(
    () => selectCitedSources('Answer without a citation.', prompt.sources),
    /does not cite/,
  );
  assert.deepEqual(selectCitedSources(INSUFFICIENT_CONTEXT_ANSWER, prompt.sources), []);
});
