import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import test from 'node:test';

import { MessageRole } from '../../../../generated/prisma/client.js';
import { app } from '../app.js';
import { disconnectPrisma, prisma } from '../config/prisma.js';
import { createTestSession } from '../test/auth-session.js';

interface ApiResponse {
  status: number;
  body: unknown;
}

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

test('GET /api/conversations returns owner-scoped previews with pagination', async (context) => {
  const suffix = randomUUID();
  const ownerId = `conversation-list-owner-${suffix}`;
  const foreignOwnerId = `conversation-list-foreign-${suffix}`;
  const ownerEmail = `${ownerId}@example.com`;
  const conversationIds = {
    first: `conversation-list-first-${suffix}`,
    second: `conversation-list-second-${suffix}`,
    third: `conversation-list-third-${suffix}`,
    fourth: `conversation-list-fourth-${suffix}`,
    deleted: `conversation-list-deleted-${suffix}`,
    foreign: `conversation-list-foreign-${suffix}`,
  };
  const longLatestQuestion =
    'Explain how authentication middleware works in Express and how JWT cookies are validated for every protected request.';
  const server = app.listen(0, '127.0.0.1');

  await listen(server);

  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const baseUrl = `http://127.0.0.1:${address.port}`;
  let ownerCookieHeader = '';

  async function request(query = '', authenticated = true): Promise<ApiResponse> {
    const response = await fetch(`${baseUrl}/api/conversations${query}`, {
      ...(authenticated ? { headers: { cookie: ownerCookieHeader } } : {}),
    });

    return {
      status: response.status,
      body: (await response.json()) as unknown,
    };
  }

  try {
    await prisma.user.createMany({
      data: [
        { id: ownerId, email: ownerEmail, passwordHash: 'test-only' },
        {
          id: foreignOwnerId,
          email: `${foreignOwnerId}@example.com`,
          passwordHash: 'test-only',
        },
      ],
    });
    ownerCookieHeader = (await createTestSession(ownerId)).cookieHeader;
    await prisma.conversation.createMany({
      data: [
        {
          id: conversationIds.first,
          userId: ownerId,
          title: 'JWT Authentication Basics',
          createdAt: new Date('2026-07-23T08:00:00.000Z'),
          updatedAt: new Date('2026-07-23T12:00:00.000Z'),
        },
        {
          id: conversationIds.second,
          userId: ownerId,
          title: 'React State Management',
          createdAt: new Date('2026-07-23T07:00:00.000Z'),
          updatedAt: new Date('2026-07-23T11:00:00.000Z'),
        },
        {
          id: conversationIds.third,
          userId: ownerId,
          title: null,
          createdAt: new Date('2026-07-23T06:00:00.000Z'),
          updatedAt: new Date('2026-07-23T10:00:00.000Z'),
        },
        {
          id: conversationIds.fourth,
          userId: ownerId,
          title: 'Docker Compose Setup',
          createdAt: new Date('2026-07-23T05:00:00.000Z'),
          updatedAt: new Date('2026-07-23T09:00:00.000Z'),
        },
        {
          id: conversationIds.deleted,
          userId: ownerId,
          title: 'Deleted Conversation',
          updatedAt: new Date('2026-07-23T14:00:00.000Z'),
          deletedAt: new Date('2026-07-23T14:30:00.000Z'),
        },
        {
          id: conversationIds.foreign,
          userId: foreignOwnerId,
          title: 'Foreign Conversation',
          updatedAt: new Date('2026-07-23T15:00:00.000Z'),
        },
      ],
    });
    await prisma.message.createMany({
      data: [
        {
          id: `conversation-list-first-user-old-${suffix}`,
          conversationId: conversationIds.first,
          role: MessageRole.USER,
          content: 'What is authentication?',
          createdAt: new Date('2026-07-23T08:10:00.000Z'),
        },
        {
          id: `conversation-list-first-user-latest-${suffix}`,
          conversationId: conversationIds.first,
          role: MessageRole.USER,
          content: longLatestQuestion,
          createdAt: new Date('2026-07-23T08:20:00.000Z'),
        },
        {
          id: `conversation-list-first-assistant-${suffix}`,
          conversationId: conversationIds.first,
          role: MessageRole.ASSISTANT,
          content: 'This newer assistant answer must not become the preview.',
          createdAt: new Date('2026-07-23T08:30:00.000Z'),
        },
        {
          id: `conversation-list-second-user-${suffix}`,
          conversationId: conversationIds.second,
          role: MessageRole.USER,
          content: '  How should React state be structured?\nPlease give examples.  ',
          createdAt: new Date('2026-07-23T07:10:00.000Z'),
        },
        {
          id: `conversation-list-third-assistant-${suffix}`,
          conversationId: conversationIds.third,
          role: MessageRole.ASSISTANT,
          content: 'An assistant-only conversation has no user preview.',
          createdAt: new Date('2026-07-23T06:10:00.000Z'),
        },
        {
          id: `conversation-list-fourth-user-${suffix}`,
          conversationId: conversationIds.fourth,
          role: MessageRole.USER,
          content: 'How should Docker Compose be configured?',
          createdAt: new Date('2026-07-23T05:10:00.000Z'),
        },
      ],
    });

    await context.test('requires authentication', async () => {
      assert.deepEqual(await request('', false), {
        status: 401,
        body: {
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication is required',
          },
        },
      });
    });

    await context.test(
      'applies defaults, owner scoping, latest USER previews, and ordering',
      async () => {
        const response = await request();

        assert.equal(response.status, 200);
        const body = response.body as {
          data: {
            conversations: Array<{
              id: string;
              title: string | null;
              preview: string | null;
            }>;
          };
          meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
          };
        };

        assert.deepEqual(
          body.data.conversations.map((conversation) => conversation.id),
          [
            conversationIds.first,
            conversationIds.second,
            conversationIds.third,
            conversationIds.fourth,
          ],
        );
        assert.equal(body.data.conversations[0]?.title, 'JWT Authentication Basics');
        assert.match(body.data.conversations[0]?.preview ?? '', /\.\.\.$/);
        assert.ok((body.data.conversations[0]?.preview?.length ?? 0) <= 80);
        assert.doesNotMatch(body.data.conversations[0]?.preview ?? '', /assistant/i);
        assert.equal(
          body.data.conversations[1]?.preview,
          'How should React state be structured? Please give examples.',
        );
        assert.equal(body.data.conversations[2]?.preview, null);
        assert.deepEqual(body.meta, {
          page: 1,
          limit: 20,
          total: 4,
          totalPages: 1,
        });
      },
    );

    await context.test('supports custom pages and calculates total pages', async () => {
      const response = await request('?page=2&limit=2');

      assert.equal(response.status, 200);
      const body = response.body as {
        data: { conversations: Array<{ id: string }> };
        meta: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };
      assert.deepEqual(
        body.data.conversations.map((conversation) => conversation.id),
        [conversationIds.third, conversationIds.fourth],
      );
      assert.deepEqual(body.meta, {
        page: 2,
        limit: 2,
        total: 4,
        totalPages: 2,
      });
    });

    await context.test('uses existing validation errors for invalid pagination', async () => {
      for (const query of ['?page=0', '?page=abc', '?limit=0', '?limit=101']) {
        const response = await request(query);

        assert.equal(response.status, 400);
        assert.equal((response.body as { error: { code: string } }).error.code, 'INVALID_INPUT');
      }
    });
  } finally {
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, foreignOwnerId] } },
    });
    await closeServer(server);
    await disconnectPrisma();
  }
});
