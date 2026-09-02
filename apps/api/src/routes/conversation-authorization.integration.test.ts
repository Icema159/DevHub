import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import test from 'node:test';

import { MessageRole } from '../../../../generated/prisma/client.js';
import { app } from '../app.js';
import { closeResourceRateLimitService } from '../config/resource-rate-limiter.js';
import { disconnectPrisma, prisma } from '../config/prisma.js';
import { createTestRequestHeaders, createTestSession } from '../test/auth-session.js';

interface ApiResponse {
  status: number;
  body: unknown;
}

const notFoundResponse = {
  error: {
    code: 'CONVERSATION_NOT_FOUND',
    message: 'Conversation was not found',
  },
};

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

test('conversation detail and message routes preserve owner isolation', async (context) => {
  const suffix = randomUUID();
  const ownerId = `conversation-auth-owner-${suffix}`;
  const foreignOwnerId = `conversation-auth-foreign-owner-${suffix}`;
  const ownerConversationId = `conversation-auth-owner-conversation-${suffix}`;
  const foreignConversationId = `conversation-auth-foreign-conversation-${suffix}`;
  const deletedConversationId = `conversation-auth-deleted-conversation-${suffix}`;
  const missingConversationId = `conversation-auth-missing-conversation-${suffix}`;
  const ownerUserMessageId = `conversation-auth-owner-user-message-${suffix}`;
  const ownerAssistantMessageId = `conversation-auth-owner-assistant-message-${suffix}`;
  const foreignMessageId = `conversation-auth-foreign-message-${suffix}`;
  const server = app.listen(0, '127.0.0.1');

  await listen(server);

  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const baseUrl = `http://127.0.0.1:${address.port}`;
  let ownerCookieHeader = '';

  async function request(
    path: string,
    options: { authenticated?: boolean; body?: Record<string, unknown>; method?: string } = {},
  ): Promise<ApiResponse> {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...createTestRequestHeaders(
          options.authenticated === false ? undefined : ownerCookieHeader,
        ),
        ...(options.body ? { 'content-type': 'application/json' } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });

    return {
      status: response.status,
      body: (await response.json()) as unknown,
    };
  }

  try {
    await prisma.user.createMany({
      data: [
        {
          id: ownerId,
          email: `${ownerId}@example.com`,
          passwordHash: 'test-only',
          emailVerifiedAt: new Date(),
        },
        {
          id: foreignOwnerId,
          email: `${foreignOwnerId}@example.com`,
          passwordHash: 'test-only',
          emailVerifiedAt: new Date(),
        },
      ],
    });
    ownerCookieHeader = (await createTestSession(ownerId)).cookieHeader;
    await prisma.conversation.createMany({
      data: [
        {
          id: ownerConversationId,
          userId: ownerId,
          title: 'Owner conversation',
        },
        {
          id: foreignConversationId,
          userId: foreignOwnerId,
          title: 'Foreign conversation title must stay private',
        },
        {
          id: deletedConversationId,
          userId: ownerId,
          title: 'Deleted conversation title must stay private',
          deletedAt: new Date(),
        },
      ],
    });
    await prisma.message.createMany({
      data: [
        {
          id: ownerUserMessageId,
          conversationId: ownerConversationId,
          role: MessageRole.USER,
          content: 'Owner question',
          createdAt: new Date('2026-08-20T08:00:00.000Z'),
        },
        {
          id: ownerAssistantMessageId,
          conversationId: ownerConversationId,
          role: MessageRole.ASSISTANT,
          content: 'Owner answer [S1].',
          citations: [
            {
              label: 'S1',
              documentId: `owner-document-${suffix}`,
              documentName: 'Owner Source.pdf',
              chunkId: `owner-chunk-${suffix}`,
              chunkPosition: 0,
              page: 1,
            },
          ],
          createdAt: new Date('2026-08-20T08:01:00.000Z'),
        },
        {
          id: foreignMessageId,
          conversationId: foreignConversationId,
          role: MessageRole.ASSISTANT,
          content: 'Foreign message content must stay private.',
          citations: [
            {
              label: 'S1',
              documentId: `foreign-document-${suffix}`,
              documentName: 'Foreign Secret.pdf',
              chunkId: `foreign-chunk-${suffix}`,
              chunkPosition: 7,
              page: 42,
            },
          ],
        },
      ],
    });

    await context.test('requires authentication', async () => {
      assert.deepEqual(
        await request(`/api/conversations/${ownerConversationId}`, { authenticated: false }),
        {
          status: 401,
          body: {
            error: {
              code: 'UNAUTHENTICATED',
              message: 'Authentication is required',
            },
          },
        },
      );
    });

    await context.test(
      'returns only the owner conversation and its public message chain',
      async () => {
        const response = await request(`/api/conversations/${ownerConversationId}`);

        assert.equal(response.status, 200);
        const serialized = JSON.stringify(response.body);
        assert.match(serialized, /Owner conversation/);
        assert.match(serialized, /Owner Source\.pdf/);
        assert.doesNotMatch(serialized, /Foreign conversation|Foreign message|Foreign Secret/);
        assert.doesNotMatch(serialized, /userId|ownerId|aiMetadata/);

        const body = response.body as {
          data: { conversation: { messages: Array<{ id: string; role: MessageRole }> } };
        };
        assert.deepEqual(
          body.data.conversation.messages.map((message) => ({
            id: message.id,
            role: message.role,
          })),
          [
            { id: ownerUserMessageId, role: MessageRole.USER },
            { id: ownerAssistantMessageId, role: MessageRole.ASSISTANT },
          ],
        );
      },
    );

    await context.test(
      'uses one indistinguishable 404 for foreign, missing, and deleted IDs',
      async () => {
        for (const conversationId of [
          foreignConversationId,
          missingConversationId,
          deletedConversationId,
        ]) {
          assert.deepEqual(await request(`/api/conversations/${conversationId}`), {
            status: 404,
            body: notFoundResponse,
          });
        }
      },
    );

    await context.test('rejects malformed IDs with the existing validation contract', async () => {
      assert.deepEqual(await request('/api/conversations/malformed%20id'), {
        status: 400,
        body: {
          error: {
            code: 'INVALID_INPUT',
            message: 'Conversation ID is invalid',
          },
        },
      });
    });

    await context.test(
      'cannot post into a foreign conversation or override session ownership',
      async () => {
        const foreignMessageCountBefore = await prisma.message.count({
          where: { conversationId: foreignConversationId },
        });

        for (const suffix of ['/messages', '/messages/stream']) {
          assert.deepEqual(
            await request(`/api/conversations/${foreignConversationId}${suffix}`, {
              method: 'POST',
              body: {
                content: 'Attempted cross-owner message',
                userId: foreignOwnerId,
                ownerId: foreignOwnerId,
                citations: [{ documentName: 'Client supplied citation' }],
              },
            }),
            {
              status: 404,
              body: notFoundResponse,
            },
          );
        }
        assert.equal(
          await prisma.message.count({ where: { conversationId: foreignConversationId } }),
          foreignMessageCountBefore,
        );
        assert.equal(
          await prisma.message.count({
            where: {
              conversationId: ownerConversationId,
              content: 'Attempted cross-owner message',
            },
          }),
          0,
        );
      },
    );
  } finally {
    await closeServer(server);
    await closeResourceRateLimitService();
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, foreignOwnerId] } } });
    await disconnectPrisma();
  }
});
