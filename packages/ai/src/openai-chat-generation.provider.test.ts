import assert from 'node:assert/strict';
import test from 'node:test';

import { formatChatGenerationInput } from './openai-chat-generation.provider.js';

const baseInput = {
  systemInstructions: 'Use retrieved sources for facts.',
  context: '[S1] JWT storage guidance.',
  userQuestion: 'Where should I store it?',
  model: 'mock-model',
  maxOutputTokens: 800,
};

test('separates conversation history from factual retrieved context', () => {
  const input = formatChatGenerationInput({
    ...baseInput,
    conversationContext: 'USER: How does JWT authentication work?',
  });

  assert.match(
    input,
    /^<conversation_context>\nUSER: How does JWT authentication work\?\n<\/conversation_context>/,
  );
  assert.match(input, /<retrieved_context>\n\[S1\] JWT storage guidance\.\n<\/retrieved_context>/);
  assert.match(input, /<user_question>\nWhere should I store it\?\n<\/user_question>$/);
});

test('omits the conversation section when no history is available', () => {
  const input = formatChatGenerationInput(baseInput);

  assert.doesNotMatch(input, /conversation_context/);
  assert.match(input, /^<retrieved_context>/);
});
