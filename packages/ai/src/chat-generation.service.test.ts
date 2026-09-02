import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ChatGenerationService,
  type ChatGenerationProvider,
  type ChatGenerationProviderInput,
} from './chat-generation.service.js';

test('passes grounded prompt parts to the provider and records generation metadata', async () => {
  let receivedInput: ChatGenerationProviderInput | undefined;
  const times = [100, 142];
  const provider: ChatGenerationProvider = {
    providerName: 'mock-provider',
    async generateAnswer(input) {
      receivedInput = input;
      return {
        answer: 'Authentication uses JWT cookies [S1].',
        model: 'mock-chat-model-1',
        usage: {
          inputTokens: 120,
          outputTokens: 12,
          totalTokens: 132,
        },
      };
    },
  };
  const service = new ChatGenerationService(provider, {
    model: 'configured-chat-model',
    maxOutputTokens: 800,
    now: () => times.shift() ?? 142,
  });

  const result = await service.generateAnswer({
    systemInstructions: 'Use only the context.',
    conversationContext: 'USER: What is a JWT?\n\nASSISTANT: It is a signed token.',
    context: '[S1] JWT cookie details.',
    userQuestion: 'How does authentication work?',
  });

  assert.equal(receivedInput?.model, 'configured-chat-model');
  assert.equal(receivedInput?.maxOutputTokens, 800);
  assert.equal(receivedInput?.context, '[S1] JWT cookie details.');
  assert.equal(
    receivedInput?.conversationContext,
    'USER: What is a JWT?\n\nASSISTANT: It is a signed token.',
  );
  assert.deepEqual(result, {
    answer: 'Authentication uses JWT cookies [S1].',
    model: 'mock-chat-model-1',
    usage: {
      inputTokens: 120,
      outputTokens: 12,
      totalTokens: 132,
    },
    provider: 'mock-provider',
    generationDurationMs: 42,
  });
});

test('rejects an empty provider answer', async () => {
  const provider: ChatGenerationProvider = {
    providerName: 'mock-provider',
    async generateAnswer() {
      return { answer: '   ', model: 'mock-chat-model' };
    },
  };
  const service = new ChatGenerationService(provider, {
    model: 'configured-chat-model',
    maxOutputTokens: 800,
  });

  await assert.rejects(
    () =>
      service.generateAnswer({
        systemInstructions: 'Use only context.',
        context: '[S1] context',
        userQuestion: 'question',
      }),
    /Generated answer must not be empty/,
  );
});

test('forwards provider deltas and attaches metadata only to the completed result', async () => {
  const times = [200, 245];
  const provider: ChatGenerationProvider = {
    providerName: 'mock-provider',
    async generateAnswer() {
      throw new Error('non-streaming path should not be used');
    },
    async *streamAnswer() {
      yield { type: 'delta', delta: 'First ' };
      yield { type: 'delta', delta: 'tokens' };
      yield {
        type: 'completed',
        result: {
          answer: 'First tokens',
          model: 'mock-stream-model',
          usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
        },
      };
    },
  };
  const service = new ChatGenerationService(provider, {
    model: 'configured-chat-model',
    maxOutputTokens: 800,
    now: () => times.shift() ?? 245,
  });
  const events = [];

  for await (const event of service.streamAnswer({
    systemInstructions: 'Use only context.',
    context: '[S1] context',
    userQuestion: 'question',
  })) {
    events.push(event);
  }

  assert.deepEqual(events, [
    { type: 'delta', delta: 'First ' },
    { type: 'delta', delta: 'tokens' },
    {
      type: 'completed',
      result: {
        answer: 'First tokens',
        model: 'mock-stream-model',
        usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
        provider: 'mock-provider',
        generationDurationMs: 45,
      },
    },
  ]);
});
