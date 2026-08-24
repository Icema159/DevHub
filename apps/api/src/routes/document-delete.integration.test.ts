import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import test from 'node:test';

import { DocumentStatus } from '../../../../generated/prisma/client.js';
import { app } from '../app.js';
import { disconnectPrisma, prisma } from '../config/prisma.js';
import {
  closeDocumentDeletionQueue,
  getDocumentDeletionQueue,
} from '../queues/document-deletion.queue.js';
import { closeDocumentProcessingQueue } from '../queues/document-processing.queue.js';
import { createTestRequestHeaders, createTestSession } from '../test/auth-session.js';

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

test('DELETE /api/documents/:documentId soft deletes owned documents and queues cleanup', async (context) => {
  const suffix = randomUUID();
  const ownerId = `delete-owner-${suffix}`;
  const foreignOwnerId = `delete-foreign-owner-${suffix}`;
  const ownedDocumentId = `delete-owned-${suffix}`;
  const foreignDocumentId = `delete-foreign-${suffix}`;
  const alreadyDeletedDocumentId = `delete-already-${suffix}`;
  const missingDocumentId = `delete-missing-${suffix}`;
  const ownerEmail = `${ownerId}@example.com`;
  const server = app.listen(0, '127.0.0.1');

  await listen(server);

  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const baseUrl = `http://127.0.0.1:${address.port}`;
  let ownerCookieHeader = '';

  async function request(documentId: string, authenticated = true): Promise<ApiResponse> {
    const response = await fetch(`${baseUrl}/api/documents/${documentId}`, {
      method: 'DELETE',
      headers: createTestRequestHeaders(authenticated ? ownerCookieHeader : undefined),
    });

    return {
      status: response.status,
      body: (await response.json()) as unknown,
    };
  }

  const notFoundResponse = {
    status: 404,
    body: {
      error: {
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Document not found.',
      },
    },
  };

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
    await prisma.document.createMany({
      data: [
        {
          id: ownedDocumentId,
          userId: ownerId,
          name: 'Owned.pdf',
          storageKey: `tests/${ownedDocumentId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 100n,
          fileHash: `hash-${ownedDocumentId}`,
          status: DocumentStatus.READY,
        },
        {
          id: foreignDocumentId,
          userId: foreignOwnerId,
          name: 'Foreign.pdf',
          storageKey: `tests/${foreignDocumentId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 200n,
          fileHash: `hash-${foreignDocumentId}`,
          status: DocumentStatus.READY,
        },
        {
          id: alreadyDeletedDocumentId,
          userId: ownerId,
          name: 'Already deleted.pdf',
          storageKey: `tests/${alreadyDeletedDocumentId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 300n,
          fileHash: `hash-${alreadyDeletedDocumentId}`,
          status: DocumentStatus.READY,
          deletedAt: new Date('2026-07-22T17:00:00.000Z'),
        },
      ],
    });

    await context.test('requires authentication', async () => {
      assert.deepEqual(await request(ownedDocumentId, false), {
        status: 401,
        body: {
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication is required',
          },
        },
      });
    });

    await context.test('hides foreign, missing, and already deleted documents', async () => {
      assert.deepEqual(await request(foreignDocumentId), notFoundResponse);
      assert.deepEqual(await request(missingDocumentId), notFoundResponse);
      assert.deepEqual(await request(alreadyDeletedDocumentId), notFoundResponse);
    });

    await context.test('sets deletedAt and creates the cleanup job', async () => {
      const response = await request(ownedDocumentId);

      assert.equal(response.status, 202);
      const body = response.body as {
        data: { document: { id: string; deletedAt: string } };
      };
      assert.equal(body.data.document.id, ownedDocumentId);
      assert.ok(Number.isFinite(Date.parse(body.data.document.deletedAt)));

      const storedDocument = await prisma.document.findUniqueOrThrow({
        where: { id: ownedDocumentId },
        select: { deletedAt: true },
      });
      assert.equal(storedDocument.deletedAt?.toISOString(), body.data.document.deletedAt);

      const job = await getDocumentDeletionQueue().getJob(`deletion-${ownedDocumentId}`);
      assert.ok(job);
      assert.deepEqual(job.data, { documentId: ownedDocumentId, userId: ownerId });

      assert.deepEqual(await request(ownedDocumentId), notFoundResponse);
    });
  } finally {
    const job = await getDocumentDeletionQueue().getJob(`deletion-${ownedDocumentId}`);
    await job?.remove();
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, foreignOwnerId] } } });
    await closeServer(server);
    await closeDocumentDeletionQueue();
    await closeDocumentProcessingQueue();
    await disconnectPrisma();
  }
});
