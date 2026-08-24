import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import test from 'node:test';

import { DocumentStatus } from '../../../../generated/prisma/client.js';
import { app } from '../app.js';
import { disconnectPrisma, prisma } from '../config/prisma.js';
import { closeDocumentProcessingQueue } from '../queues/document-processing.queue.js';
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

test('GET /api/documents/:documentId is authenticated, owner-scoped, and returns a safe DTO', async (context) => {
  const suffix = randomUUID();
  const ownerId = `document-owner-${suffix}`;
  const foreignOwnerId = `document-foreign-owner-${suffix}`;
  const failedDocumentId = `document-failed-${suffix}`;
  const readyDocumentId = `document-ready-${suffix}`;
  const foreignDocumentId = `document-foreign-${suffix}`;
  const deletedDocumentId = `document-deleted-${suffix}`;
  const missingDocumentId = `document-missing-${suffix}`;
  const failedCreatedAt = new Date('2026-07-20T11:15:00.000Z');
  const failedUpdatedAt = new Date('2026-07-20T11:16:00.000Z');
  const readyProcessedAt = new Date('2026-07-20T11:17:00.000Z');
  const server = app.listen(0, '127.0.0.1');

  await listen(server);

  const address = server.address();

  assert.ok(address && typeof address === 'object');

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const ownerEmail = `${ownerId}@example.com`;
  let ownerCookieHeader = '';

  async function request(path: string, authenticated = true): Promise<ApiResponse> {
    const response = await fetch(
      `${baseUrl}${path}`,
      authenticated ? { headers: { cookie: ownerCookieHeader } } : {},
    );

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
    await prisma.document.createMany({
      data: [
        {
          id: failedDocumentId,
          userId: ownerId,
          name: 'Authentication Guide.pdf',
          storageKey: `tests/${failedDocumentId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 1_887_436n,
          fileHash: `hash-${failedDocumentId}`,
          status: DocumentStatus.FAILED,
          processingError: 'Document embedding generation failed',
          createdAt: failedCreatedAt,
          updatedAt: failedUpdatedAt,
          metadata: { internalExtractionDetail: 'must-not-be-returned' },
        },
        {
          id: readyDocumentId,
          userId: ownerId,
          name: 'Ready Document.pdf',
          storageKey: `tests/${readyDocumentId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 2_048n,
          fileHash: `hash-${readyDocumentId}`,
          status: DocumentStatus.READY,
          processingError: 'stale internal error',
          processedAt: readyProcessedAt,
        },
        {
          id: foreignDocumentId,
          userId: foreignOwnerId,
          name: 'Foreign Document.pdf',
          storageKey: `tests/${foreignDocumentId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 4_096n,
          fileHash: `hash-${foreignDocumentId}`,
          status: DocumentStatus.READY,
        },
        {
          id: deletedDocumentId,
          userId: ownerId,
          name: 'Deleted Document.pdf',
          storageKey: `tests/${deletedDocumentId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 8_192n,
          fileHash: `hash-${deletedDocumentId}`,
          status: DocumentStatus.READY,
          deletedAt: new Date('2026-07-20T12:00:00.000Z'),
        },
      ],
    });

    await context.test(
      'rejects an unauthenticated request with the existing 401 contract',
      async () => {
        assert.deepEqual(await request(`/api/documents/${failedDocumentId}`, false), {
          status: 401,
          body: {
            error: {
              code: 'UNAUTHENTICATED',
              message: 'Authentication is required',
            },
          },
        });
      },
    );

    await context.test(
      "returns the owner's FAILED document and its safe processing error",
      async () => {
        const response = await request(`/api/documents/${failedDocumentId}`);

        assert.deepEqual(response, {
          status: 200,
          body: {
            data: {
              document: {
                id: failedDocumentId,
                filename: 'Authentication Guide.pdf',
                mimeType: 'application/pdf',
                size: 1_887_436,
                processingState: 'FAILED',
                processingError: 'Document embedding generation failed',
                createdAt: failedCreatedAt.toISOString(),
                updatedAt: failedUpdatedAt.toISOString(),
                processedAt: null,
              },
            },
          },
        });

        const document = (response.body as { data: { document: Record<string, unknown> } }).data
          .document;

        for (const forbiddenField of [
          'userId',
          'storageKey',
          'fileHash',
          'metadata',
          'chunks',
          'embeddings',
          'embeddingModel',
          'queueJobId',
          'user',
        ]) {
          assert.equal(Object.hasOwn(document, forbiddenField), false);
        }
      },
    );

    await context.test('returns null processingError for a non-FAILED document', async () => {
      const response = await request(`/api/documents/${readyDocumentId}`);

      assert.equal(response.status, 200);
      assert.equal(
        (response.body as { data: { document: { processingError: unknown } } }).data.document
          .processingError,
        null,
      );
    });

    await context.test('uses the same 404 contract for foreign and missing documents', async () => {
      const expectedResponse = {
        status: 404,
        body: {
          error: {
            code: 'DOCUMENT_NOT_FOUND',
            message: 'Document not found.',
          },
        },
      };

      assert.deepEqual(await request(`/api/documents/${foreignDocumentId}`), expectedResponse);
      assert.deepEqual(await request(`/api/documents/${missingDocumentId}`), expectedResponse);
      assert.deepEqual(await request(`/api/documents/${deletedDocumentId}`), expectedResponse);
    });

    await context.test(
      'rejects a malformed document ID using existing validation errors',
      async () => {
        assert.deepEqual(await request('/api/documents/contains%20spaces'), {
          status: 400,
          body: {
            error: {
              code: 'INVALID_INPUT',
              message: 'Document ID is invalid',
            },
          },
        });
      },
    );
  } finally {
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, foreignOwnerId] } },
    });
    await closeServer(server);
    await closeDocumentProcessingQueue();
    await disconnectPrisma();
  }
});
