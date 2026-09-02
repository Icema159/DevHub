import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import test from 'node:test';

import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from 'undici';

import { app } from '../app.js';
import { closeResourceRateLimitService } from '../config/resource-rate-limiter.js';
import { disconnectPrisma, prisma } from '../config/prisma.js';
import { INSUFFICIENT_CONTEXT_ANSWER } from '../services/rag-prompt.service.js';
import { createTestRequestHeaders, createTestSession } from '../test/auth-session.js';

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('listening', () => resolve());
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

interface ParsedSseEvent {
  event: string;
  data: unknown;
}

function parseSseEvents(raw: string): ParsedSseEvent[] {
  return raw
    .split('\n\n')
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n');
      const eventLine = lines.find((line) => line.startsWith('event: '));
      const dataLine = lines.find((line) => line.startsWith('data: '));

      assert.ok(eventLine && dataLine, `malformed SSE block: ${block}`);

      return {
        event: eventLine.slice('event: '.length),
        data: JSON.parse(dataLine.slice('data: '.length)) as unknown,
      };
    });
}

test('conversation message stream returns the expected SSE wire format', async (context) => {
  const suffix = randomUUID();
  const ownerId = `conversation-stream-owner-${suffix}`;
  const conversationId = `conversation-stream-conversation-${suffix}`;
  const server = app.listen(0, '127.0.0.1');

  // This test's user has no ingested documents, so real retrieval legitimately
  // finds zero chunks regardless of the embedding's values -- that drives the
  // real "insufficient context" code path (status -> delta -> completed) with
  // no fabricated chat-completion response required. The only outbound call
  // retrieval still makes is embedding the question text, so that single call
  // is intercepted here to guarantee this test never reaches the live OpenAI
  // API, matching the ticket's "no live OpenAI" requirement.
  const originalDispatcher = getGlobalDispatcher();
  const mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  mockAgent.enableNetConnect(/^127\.0\.0\.1/);
  mockAgent
    .get('https://api.openai.com')
    .intercept({ path: '/v1/embeddings', method: 'POST' })
    .reply(
      200,
      {
        object: 'list',
        data: [{ object: 'embedding', index: 0, embedding: new Array(1536).fill(0.001) }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 5, total_tokens: 5 },
      },
      { headers: { 'content-type': 'application/json' } },
    )
    .persist();
  setGlobalDispatcher(mockAgent);

  await listen(server);

  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const baseUrl = `http://127.0.0.1:${address.port}`;
  let cookieHeader = '';

  async function streamRequest(
    path: string,
    options: { authenticated?: boolean; body?: Record<string, unknown> } = {},
  ): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        ...createTestRequestHeaders(options.authenticated === false ? undefined : cookieHeader),
        'content-type': 'application/json',
      },
      body: JSON.stringify(options.body ?? { content: 'What is the refund policy?' }),
    });
  }

  try {
    await prisma.user.create({
      data: {
        id: ownerId,
        email: `${ownerId}@example.com`,
        passwordHash: 'test-only',
        emailVerifiedAt: new Date(),
      },
    });
    cookieHeader = (await createTestSession(ownerId)).cookieHeader;
    await prisma.conversation.create({
      data: { id: conversationId, userId: ownerId, title: null },
    });

    await context.test('requires authentication', async () => {
      const response = await streamRequest(`/api/conversations/${conversationId}/messages/stream`, {
        authenticated: false,
      });

      assert.equal(response.status, 401);
      assert.equal(response.headers.get('content-type')?.includes('text/event-stream'), false);
      assert.deepEqual(await response.json(), {
        error: { code: 'UNAUTHENTICATED', message: 'Authentication is required' },
      });
    });

    await context.test(
      'streams user_message, status, delta, and completed events over text/event-stream',
      async () => {
        const response = await streamRequest(
          `/api/conversations/${conversationId}/messages/stream`,
          { body: { content: 'What is the refund policy?' } },
        );

        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type') ?? '', /^text\/event-stream/);
        assert.equal(
          response.headers.get('cache-control'),
          'private, no-cache, no-store, must-revalidate',
        );
        assert.equal(response.headers.get('connection'), 'keep-alive');

        const events = parseSseEvents(await response.text());

        assert.deepEqual(
          events.map((event) => event.event),
          ['user_message', 'status', 'status', 'delta', 'completed'],
        );

        const userMessageEvent = events[0]!.data as {
          type: string;
          message: { content: string };
        };
        assert.equal(userMessageEvent.type, 'user_message');
        assert.equal(userMessageEvent.message.content, 'What is the refund policy?');

        assert.deepEqual(events[1]!.data, { type: 'status', phase: 'retrieving' });
        assert.deepEqual(events[2]!.data, { type: 'status', phase: 'generating' });
        assert.deepEqual(events[3]!.data, { type: 'delta', delta: INSUFFICIENT_CONTEXT_ANSWER });

        const completedEvent = events[4]!.data as {
          type: string;
          result: { message: { content: string }; sources: unknown[] };
        };
        assert.equal(completedEvent.type, 'completed');
        assert.equal(completedEvent.result.message.content, INSUFFICIENT_CONTEXT_ANSWER);
        assert.deepEqual(completedEvent.result.sources, []);
      },
    );

    // Error-event coverage: a failure raised before the stream's first event
    // (unauthenticated, missing/foreign conversation -- see
    // conversation-authorization.integration.test.ts) surfaces as a normal
    // JSON error response, not SSE, because streamConversationMessage only
    // switches to an `event: error` SSE frame once headers have already been
    // sent. Deterministically forcing a failure *after* the first event would
    // need a dependency-injection seam into the running app's
    // conversationService singleton that does not exist today; adding one is
    // out of scope for this focused wire-format test, so that path is left to
    // a future service-level test built on the existing
    // createConversationService(dependencies) pattern already used by
    // conversation.service.test.ts.
  } finally {
    setGlobalDispatcher(originalDispatcher);
    await mockAgent.close();
    await closeServer(server);
    await closeResourceRateLimitService();
    await prisma.message.deleteMany({ where: { conversationId } });
    await prisma.conversation.deleteMany({ where: { id: conversationId } });
    await prisma.user.deleteMany({ where: { id: ownerId } });
    await disconnectPrisma();
  }
});
