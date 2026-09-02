import assert from 'node:assert/strict';
import test from 'node:test';

import { MessageRole } from '../../../../generated/prisma/client.js';
import type { GeneratedChatAnswer } from '@developer-knowledge-hub/ai/chat-generation';

import type {
  CompleteConversationTurnInput,
  ConversationDetailRecord,
  ConversationListRecord,
  ConversationRecord,
  PublicMessageRecord,
} from '../repositories/conversation.repository.js';
import type { RetrievedChunk } from '../repositories/vector.repository.js';
import { AppError } from '../utils/app-error.js';
import {
  createConversationService,
  type ConversationServiceDependencies,
} from './conversation.service.js';
import {
  INSUFFICIENT_CONTEXT_ANSWER,
  MAX_CONVERSATION_CONTEXT_MESSAGES,
} from './rag-prompt.service.js';

const createdAt = new Date('2026-07-20T09:00:00.000Z');
const updatedAt = new Date('2026-07-20T09:01:00.000Z');

function conversation(overrides: Partial<ConversationRecord> = {}): ConversationRecord {
  return {
    id: 'conversation-a',
    title: null,
    createdAt,
    updatedAt,
    ...overrides,
  };
}

function conversationListItem(
  overrides: Partial<ConversationListRecord> = {},
): ConversationListRecord {
  return {
    ...conversation(),
    messages: [{ content: 'How does authentication work?' }],
    ...overrides,
  };
}

function message(
  role: typeof MessageRole.USER | typeof MessageRole.ASSISTANT,
  overrides: Partial<PublicMessageRecord> = {},
): PublicMessageRecord {
  return {
    id: role === MessageRole.USER ? 'message-user' : 'message-assistant',
    role,
    content: role === MessageRole.USER ? 'How does authentication work?' : 'JWTs are used [S1].',
    citations: role === MessageRole.USER ? null : [],
    createdAt,
    ...overrides,
  };
}

function retrievedChunk(): RetrievedChunk {
  return {
    chunkId: 'chunk-a',
    content: 'Authentication uses a signed JWT in an HttpOnly cookie.',
    documentId: 'document-a',
    documentName: 'Authentication.pdf',
    chunkPosition: 3,
    page: 12,
    similarity: 0.95,
  };
}

function generatedAnswer(): GeneratedChatAnswer {
  return {
    answer: 'Authentication uses a signed JWT in an HttpOnly cookie [S1].',
    provider: 'mock-openai',
    model: 'mock-chat-model',
    usage: {
      inputTokens: 150,
      outputTokens: 20,
      totalTokens: 170,
    },
    generationDurationMs: 42,
  };
}

function dependencies(
  overrides: Partial<ConversationServiceDependencies> = {},
): ConversationServiceDependencies {
  const ownConversation = conversation();

  return {
    async createConversation() {
      return ownConversation;
    },
    async listConversations() {
      return {
        conversations: [conversationListItem()],
        total: 1,
      };
    },
    async findConversation() {
      return ownConversation;
    },
    async findConversationDetail() {
      return {
        ...ownConversation,
        messages: [],
      };
    },
    async createUserMessage() {
      return message(MessageRole.USER);
    },
    async completeTurn() {
      return message(MessageRole.ASSISTANT);
    },
    async deleteUserMessage() {
      return true;
    },
    async findFirstUserMessage() {
      return {
        id: 'message-user',
        content: 'How does authentication work?',
      };
    },
    async loadRecentContext() {
      return [];
    },
    async saveTitle() {
      return true;
    },
    async reserveTurn() {
      return { allowed: true, reservationId: 'turn-reservation-a' };
    },
    async releaseTurn() {},
    async retrieve() {
      return [retrievedChunk()];
    },
    async generateAnswer() {
      return generatedAnswer();
    },
    async generateTitle() {
      return 'Authentication Basics';
    },
    ...overrides,
  };
}

test('creates, lists, and reads only through the authenticated user context', async () => {
  const receivedUserIds: string[] = [];
  const detail: ConversationDetailRecord = {
    ...conversation(),
    messages: [
      message(MessageRole.USER),
      message(MessageRole.ASSISTANT, {
        citations: [
          {
            label: 'S1',
            documentId: 'document-a',
            documentName: 'Authentication.pdf',
            chunkId: 'chunk-a',
            chunkPosition: 3,
            page: 12,
          },
        ],
      }),
    ],
  };
  const service = createConversationService(
    dependencies({
      async createConversation(userId) {
        receivedUserIds.push(userId);
        return conversation();
      },
      async listConversations(userId) {
        receivedUserIds.push(userId);
        return {
          conversations: [conversationListItem()],
          total: 1,
        };
      },
      async findConversationDetail(conversationId, userId) {
        assert.equal(conversationId, 'conversation-a');
        receivedUserIds.push(userId);
        return detail;
      },
    }),
  );

  await service.create('user-a');
  const list = await service.list('user-a', { page: 1, limit: 20 });
  const result = await service.get('conversation-a', 'user-a');

  assert.deepEqual(receivedUserIds, ['user-a', 'user-a', 'user-a']);
  assert.equal(list.conversations[0]?.preview, 'How does authentication work?');
  assert.deepEqual(list.meta, {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  });
  assert.deepEqual(
    result.messages.map((item) => item.role),
    [MessageRole.USER, MessageRole.ASSISTANT],
  );
  assert.equal(result.messages[1]?.sources[0]?.label, 'S1');
});

test('hides another users conversation for reads and message creation', async () => {
  let userMessageCreated = false;
  const service = createConversationService(
    dependencies({
      async findConversation() {
        return null;
      },
      async findConversationDetail() {
        return null;
      },
      async createUserMessage() {
        userMessageCreated = true;
        return message(MessageRole.USER);
      },
    }),
  );

  await assert.rejects(
    () => service.get('conversation-a', 'user-b'),
    (error) => error instanceof AppError && error.statusCode === 404,
  );
  await assert.rejects(
    () => service.addMessage('conversation-a', 'user-b', 'Question'),
    (error) => error instanceof AppError && error.statusCode === 404,
  );
  assert.equal(userMessageCreated, false);
});

test('persists a grounded USER and ASSISTANT turn with separate citations and AI metadata', async () => {
  const events: string[] = [];
  let providerInput:
    | {
        systemInstructions: string;
        conversationContext?: string;
        context: string;
        userQuestion: string;
      }
    | undefined;
  let completionInput: CompleteConversationTurnInput | undefined;
  const service = createConversationService(
    dependencies({
      async findConversation() {
        events.push('find-conversation');
        return conversation();
      },
      async createUserMessage() {
        events.push('save-user');
        return message(MessageRole.USER);
      },
      async retrieve(userId, question) {
        events.push('retrieve');
        assert.equal(userId, 'user-a');
        assert.equal(question, 'How does authentication work?');
        return [retrievedChunk()];
      },
      async generateAnswer(_userId, input) {
        events.push('generate-answer');
        providerInput = input;
        return generatedAnswer();
      },
      async completeTurn(input) {
        events.push('save-assistant');
        completionInput = input;
        return message(MessageRole.ASSISTANT, { content: generatedAnswer().answer });
      },
    }),
  );

  const result = await service.addMessage(
    'conversation-a',
    'user-a',
    'How does authentication work?',
  );

  assert.deepEqual(events, [
    'find-conversation',
    'save-user',
    'retrieve',
    'generate-answer',
    'save-assistant',
  ]);
  assert.match(providerInput?.context ?? '', /\[S1\]/);
  assert.match(providerInput?.context ?? '', /Authentication\.pdf/);
  assert.equal(providerInput?.conversationContext, undefined);
  assert.equal(providerInput?.userQuestion, 'How does authentication work?');
  assert.deepEqual(completionInput?.sourceChunkIds, ['chunk-a']);
  assert.deepEqual(completionInput?.citations, [
    {
      label: 'S1',
      documentId: 'document-a',
      documentName: 'Authentication.pdf',
      chunkId: 'chunk-a',
      chunkPosition: 3,
      page: 12,
    },
  ]);
  assert.deepEqual(completionInput?.aiMetadata, {
    provider: 'mock-openai',
    model: 'mock-chat-model',
    generationDurationMs: 42,
    inputTokenCount: 150,
    outputTokenCount: 20,
    totalTokenCount: 170,
  });
  assert.equal(result.message.role, MessageRole.ASSISTANT);
  assert.equal(result.sources[0]?.label, 'S1');
});

test('uses bounded same-conversation history for follow-up retrieval and answer understanding', async () => {
  let retrievalQuery: string | undefined;
  let providerInput:
    | {
        systemInstructions: string;
        conversationContext?: string;
        context: string;
        userQuestion: string;
      }
    | undefined;
  const service = createConversationService(
    dependencies({
      async loadRecentContext(conversationId, userId, excludedMessageId, limit) {
        assert.equal(conversationId, 'conversation-a');
        assert.equal(userId, 'user-a');
        assert.equal(excludedMessageId, 'message-user');
        assert.equal(limit, MAX_CONVERSATION_CONTEXT_MESSAGES);
        return [
          {
            id: 'previous-user',
            role: MessageRole.USER,
            content: 'How does JWT authentication work?',
            createdAt,
          },
          {
            id: 'previous-assistant',
            role: MessageRole.ASSISTANT,
            content: 'Previous assistant wording is dialogue context, not factual evidence.',
            createdAt: updatedAt,
          },
        ];
      },
      async findFirstUserMessage() {
        return {
          id: 'previous-user',
          content: 'How does JWT authentication work?',
        };
      },
      async retrieve(userId, question) {
        assert.equal(userId, 'user-a');
        retrievalQuery = question;
        return [retrievedChunk()];
      },
      async generateAnswer(_userId, input) {
        providerInput = input;
        return generatedAnswer();
      },
    }),
  );

  const result = await service.addMessage('conversation-a', 'user-a', 'Where should I store it?');

  assert.equal(result.message.role, MessageRole.ASSISTANT);
  assert.match(retrievalQuery ?? '', /JWT authentication/);
  assert.match(retrievalQuery ?? '', /Where should I store it\?/);
  assert.match(providerInput?.conversationContext ?? '', /Previous assistant wording/);
  assert.match(providerInput?.context ?? '', /Authentication\.pdf/);
  assert.doesNotMatch(providerInput?.context ?? '', /Previous assistant wording/);
  assert.equal(providerInput?.userQuestion, 'Where should I store it?');
  assert.match(providerInput?.systemInstructions ?? '', /never treat conversation context/i);
});

test('generates, normalizes, and saves a title after the first successful turn', async () => {
  const savedTitles: string[] = [];
  let titleQuestion: string | undefined;
  const service = createConversationService(
    dependencies({
      async generateTitle(_userId, firstQuestion) {
        titleQuestion = firstQuestion;
        return 'Title: "JWT Authentication and Secure Cookie Storage for Modern Web Applications!"';
      },
      async saveTitle(conversationId, userId, title) {
        assert.equal(conversationId, 'conversation-a');
        assert.equal(userId, 'user-a');
        savedTitles.push(title);
        return true;
      },
    }),
  );

  const result = await service.addMessage(
    'conversation-a',
    'user-a',
    'How does authentication work?',
  );

  assert.equal(result.message.role, MessageRole.ASSISTANT);
  assert.equal(titleQuestion, 'How does authentication work?');
  assert.deepEqual(savedTitles, ['JWT Authentication and Secure Cookie Storage for']);
});

test('does not fail a completed turn when title generation fails', async () => {
  let titleSaved = false;
  const service = createConversationService(
    dependencies({
      async generateTitle() {
        throw new Error('raw provider details');
      },
      async saveTitle() {
        titleSaved = true;
        return true;
      },
    }),
  );

  const result = await service.addMessage(
    'conversation-a',
    'user-a',
    'How does authentication work?',
  );

  assert.equal(result.message.role, MessageRole.ASSISTANT);
  assert.equal(titleSaved, false);
});

test('keeps an existing null-title conversation functional without retitling a later turn', async () => {
  let titleGenerated = false;
  const service = createConversationService(
    dependencies({
      async findFirstUserMessage() {
        return {
          id: 'older-user-message',
          content: 'Original question',
        };
      },
      async generateTitle() {
        titleGenerated = true;
        return 'Must Not Be Generated';
      },
    }),
  );

  const result = await service.addMessage('conversation-a', 'user-a', 'Later question');

  assert.equal(result.message.role, MessageRole.ASSISTANT);
  assert.equal(titleGenerated, false);
});

test('does not regenerate a title for an already titled conversation', async () => {
  let firstMessageRead = false;
  const service = createConversationService(
    dependencies({
      async findConversation() {
        return conversation({ title: 'Existing Title' });
      },
      async findFirstUserMessage() {
        firstMessageRead = true;
        return null;
      },
    }),
  );

  const result = await service.addMessage('conversation-a', 'user-a', 'Another question');

  assert.equal(result.message.role, MessageRole.ASSISTANT);
  assert.equal(firstMessageRead, false);
});

test('persists a deterministic insufficient-context answer without calling the chat provider', async () => {
  let providerCalled = false;
  let released = false;
  let completionInput: CompleteConversationTurnInput | undefined;
  const service = createConversationService(
    dependencies({
      async retrieve() {
        return [];
      },
      async generateAnswer() {
        providerCalled = true;
        return generatedAnswer();
      },
      async completeTurn(input) {
        completionInput = input;
        return message(MessageRole.ASSISTANT, { content: input.content, citations: [] });
      },
      async releaseTurn() {
        released = true;
      },
    }),
  );

  const result = await service.addMessage('conversation-a', 'user-a', 'Unknown topic');

  assert.equal(providerCalled, false);
  assert.equal(released, true);
  assert.equal(completionInput?.content, INSUFFICIENT_CONTEXT_ANSWER);
  assert.deepEqual(completionInput?.citations, []);
  assert.deepEqual(completionInput?.sourceChunkIds, []);
  assert.equal(completionInput?.aiMetadata, undefined);
  assert.deepEqual(result.sources, []);
});

test('rejects the 31st rolling AI turn before persisting a user message', async () => {
  let messageCreated = false;
  const service = createConversationService(
    dependencies({
      async reserveTurn() {
        return { allowed: false };
      },
      async createUserMessage() {
        messageCreated = true;
        return message(MessageRole.USER);
      },
    }),
  );

  await assert.rejects(
    () => service.addMessage('conversation-a', 'user-a', 'One request too many'),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 429 &&
      error.code === 'AI_DAILY_LIMIT_REACHED',
  );
  assert.equal(messageCreated, false);
});

test('preserves insufficient-context behavior when a follow-up has conversation history', async () => {
  let retrievalQuery: string | undefined;
  let providerCalled = false;
  const service = createConversationService(
    dependencies({
      async loadRecentContext() {
        return [
          {
            id: 'previous-user',
            role: MessageRole.USER,
            content: 'How does JWT authentication work?',
            createdAt,
          },
        ];
      },
      async retrieve(_userId, question) {
        retrievalQuery = question;
        return [];
      },
      async generateAnswer() {
        providerCalled = true;
        return generatedAnswer();
      },
      async completeTurn(input) {
        return message(MessageRole.ASSISTANT, { content: input.content, citations: [] });
      },
    }),
  );

  const result = await service.addMessage('conversation-a', 'user-a', 'Where should I store it?');

  assert.match(retrievalQuery ?? '', /JWT authentication/);
  assert.equal(providerCalled, false);
  assert.equal(result.message.content, INSUFFICIENT_CONTEXT_ANSWER);
  assert.deepEqual(result.sources, []);
});

test('returns a safe provider error and compensates the saved USER message', async () => {
  const deletedMessages: string[] = [];
  const service = createConversationService(
    dependencies({
      async generateAnswer() {
        throw new Error('raw provider response containing private details');
      },
      async deleteUserMessage(messageId, conversationId, userId) {
        deletedMessages.push(`${messageId}:${conversationId}:${userId}`);
        return true;
      },
    }),
  );

  await assert.rejects(
    () => service.addMessage('conversation-a', 'user-a', 'Question'),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 503 &&
      error.code === 'AI_PROVIDER_UNAVAILABLE' &&
      !error.message.includes('private'),
  );
  assert.deepEqual(deletedMessages, ['message-user:conversation-a:user-a']);
});

test('returns a safe retrieval error and compensates the saved USER message', async () => {
  let compensated = false;
  const service = createConversationService(
    dependencies({
      async retrieve() {
        throw new Error('database connection details');
      },
      async deleteUserMessage() {
        compensated = true;
        return true;
      },
    }),
  );

  await assert.rejects(
    () => service.addMessage('conversation-a', 'user-a', 'Question'),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 500 &&
      error.code === 'RETRIEVAL_FAILED' &&
      !error.message.includes('connection'),
  );
  assert.equal(compensated, true);
});

test('returns a safe persistence error and compensates the saved USER message', async () => {
  let compensated = false;
  const service = createConversationService(
    dependencies({
      async completeTurn() {
        throw new Error('database constraint details');
      },
      async deleteUserMessage() {
        compensated = true;
        return true;
      },
    }),
  );

  await assert.rejects(
    () => service.addMessage('conversation-a', 'user-a', 'Question'),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 500 &&
      error.code === 'MESSAGE_PERSISTENCE_FAILED' &&
      !error.message.includes('constraint'),
  );
  assert.equal(compensated, true);
});

test('rejects an answer with an unavailable citation and compensates the USER message', async () => {
  let completed = false;
  let compensated = false;
  const service = createConversationService(
    dependencies({
      async generateAnswer() {
        return {
          ...generatedAnswer(),
          answer: 'Unsupported answer [S99].',
        };
      },
      async completeTurn() {
        completed = true;
        return message(MessageRole.ASSISTANT);
      },
      async deleteUserMessage() {
        compensated = true;
        return true;
      },
    }),
  );

  await assert.rejects(
    () => service.addMessage('conversation-a', 'user-a', 'Question'),
    (error) =>
      error instanceof AppError && error.statusCode === 502 && error.code === 'INVALID_AI_RESPONSE',
  );
  assert.equal(completed, false);
  assert.equal(compensated, true);
});

test('streams real answer deltas and persists exactly once before completion', async () => {
  const completedInputs: CompleteConversationTurnInput[] = [];
  const service = createConversationService(
    dependencies({
      async *streamAnswer() {
        yield { type: 'delta', delta: 'Authentication uses ' } as const;
        yield { type: 'delta', delta: 'an HttpOnly cookie [S1].' } as const;
        yield { type: 'completed', result: generatedAnswer() } as const;
      },
      async completeTurn(input) {
        completedInputs.push(input);
        return message(MessageRole.ASSISTANT, { content: input.content });
      },
    }),
  );
  const events = [];

  for await (const event of service.streamMessage(
    'conversation-a',
    'user-a',
    'How does authentication work?',
  )) {
    events.push(event);
  }

  assert.deepEqual(
    events.map((event) => event.type),
    ['user_message', 'status', 'status', 'delta', 'delta', 'completed'],
  );
  assert.equal(completedInputs.length, 1);
  assert.equal(completedInputs[0]?.content, generatedAnswer().answer);
  assert.deepEqual(completedInputs[0]?.sourceChunkIds, ['chunk-a']);
  assert.equal(events.at(-1)?.type, 'completed');
});

test('does not persist an assistant message when a streamed final citation is invalid', async () => {
  let completed = false;
  let compensated = false;
  const service = createConversationService(
    dependencies({
      async *streamAnswer() {
        yield { type: 'delta', delta: 'Unsupported partial [S99]' } as const;
        yield {
          type: 'completed',
          result: { ...generatedAnswer(), answer: 'Unsupported answer [S99].' },
        } as const;
      },
      async completeTurn() {
        completed = true;
        return message(MessageRole.ASSISTANT);
      },
      async deleteUserMessage() {
        compensated = true;
        return true;
      },
    }),
  );

  await assert.rejects(
    async () => {
      for await (const event of service.streamMessage('conversation-a', 'user-a', 'Question')) {
        void event;
        // Consume the full stream to exercise final validation.
      }
    },
    (error) => error instanceof AppError && error.code === 'INVALID_AI_RESPONSE',
  );
  assert.equal(completed, false);
  assert.equal(compensated, true);
});

test('compensates the user turn when a stream consumer disconnects before completion', async () => {
  let compensated = false;
  let released = false;
  const service = createConversationService(
    dependencies({
      async deleteUserMessage() {
        compensated = true;
        return true;
      },
      async releaseTurn() {
        released = true;
      },
    }),
  );
  const stream = service.streamMessage('conversation-a', 'user-a', 'Question');

  assert.equal((await stream.next()).value?.type, 'user_message');
  await stream.return(undefined);

  assert.equal(compensated, true);
  assert.equal(released, true);
});
