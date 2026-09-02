import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatChatGenerationInput,
  OpenAIChatGenerationProvider,
} from './openai-chat-generation.provider.js';

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

test('maps Responses API text deltas and final usage without exposing raw events', async () => {
  const provider = new OpenAIChatGenerationProvider({ apiKey: 'test-key' });
  let receivedRequest: unknown;
  let receivedOptions: unknown;
  const abortController = new AbortController();
  const responseStream = {
    async *[Symbol.asyncIterator]() {
      yield { type: 'response.output_text.delta', delta: 'Hello ' };
      yield { type: 'response.output_text.delta', delta: 'world [S1].' };
      yield {
        type: 'response.completed',
        response: {
          model: 'gpt-test',
          usage: {
            input_tokens: 20,
            output_tokens: 5,
            total_tokens: 25,
            input_tokens_details: { cached_tokens: 4 },
            output_tokens_details: { reasoning_tokens: 2 },
          },
        },
      };
    },
  };
  const client = (
    provider as unknown as {
      client: { responses: { create: (...args: unknown[]) => Promise<unknown> } };
    }
  ).client;
  client.responses.create = async (...args: unknown[]) => {
    [receivedRequest, receivedOptions] = args;
    return responseStream;
  };
  const events = [];

  for await (const event of provider.streamAnswer(baseInput, {
    signal: abortController.signal,
  })) {
    events.push(event);
  }

  assert.equal((receivedRequest as { stream?: boolean }).stream, true);
  assert.deepEqual(receivedOptions, { signal: abortController.signal });
  assert.deepEqual(events, [
    { type: 'delta', delta: 'Hello ' },
    { type: 'delta', delta: 'world [S1].' },
    {
      type: 'completed',
      result: {
        answer: 'Hello world [S1].',
        model: 'gpt-test',
        usage: {
          inputTokens: 20,
          outputTokens: 5,
          totalTokens: 25,
          cachedInputTokens: 4,
          reasoningTokens: 2,
        },
      },
    },
  ]);
});
