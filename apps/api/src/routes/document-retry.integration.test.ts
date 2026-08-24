import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import test from 'node:test';

import { DocumentStatus } from '../../../../generated/prisma/client.js';
import { DOCUMENT_PROCESSING_JOB_NAME } from '@developer-knowledge-hub/shared/queue/document-processing';
import { app } from '../app.js';
import { disconnectPrisma, prisma } from '../config/prisma.js';
import {
  closeDocumentProcessingQueue,
  getDocumentProcessingQueue,
} from '../queues/document-processing.queue.js';
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

test('POST /api/documents/:documentId/retry safely restarts owned FAILED documents', async (context) => {
  const suffix = randomUUID();
  const ownerId = `retry-owner-${suffix}`;
  const foreignOwnerId = `retry-foreign-owner-${suffix}`;
  const failedDocumentId = `retry-failed-${suffix}`;
  const foreignDocumentId = `retry-foreign-${suffix}`;
  const deletedDocumentId = `retry-deleted-${suffix}`;
  const readyDocumentId = `retry-ready-${suffix}`;
  const processingDocumentId = `retry-processing-${suffix}`;
  const missingDocumentId = `retry-missing-${suffix}`;
  const ownerEmail = `${ownerId}@example.com`;
  const priorProcessedAt = new Date('2026-07-22T09:00:00.000Z');
  const server = app.listen(0, '127.0.0.1');

  await listen(server);

  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const baseUrl = `http://127.0.0.1:${address.port}`;
  let ownerCookieHeader = '';

  async function request(documentId: string, authenticated = true): Promise<ApiResponse> {
    const response = await fetch(`${baseUrl}/api/documents/${documentId}/retry`, {
      method: 'POST',
      headers: createTestRequestHeaders(authenticated ? ownerCookieHeader : undefined),
    });

    return {
      status: response.status,
      body: (await response.json()) as unknown,
    };
  }

  async function processingJobsForDocument() {
    const jobs = await getDocumentProcessingQueue().getJobs([
      'wait',
      'active',
      'delayed',
      'completed',
      'failed',
    ]);

    return jobs.filter((job) => job.data.documentId === failedDocumentId);
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
        {
          id: ownerId,
          email: ownerEmail,
          passwordHash: 'test-only',
          emailVerifiedAt: new Date(),
        },
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
          processedAt: priorProcessedAt,
        },
        {
          id: foreignDocumentId,
          userId: foreignOwnerId,
          name: 'Foreign.pdf',
          storageKey: `tests/${foreignDocumentId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 100n,
          fileHash: `hash-${foreignDocumentId}`,
          status: DocumentStatus.FAILED,
        },
        {
          id: deletedDocumentId,
          userId: ownerId,
          name: 'Deleted.pdf',
          storageKey: `tests/${deletedDocumentId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 200n,
          fileHash: `hash-${deletedDocumentId}`,
          status: DocumentStatus.FAILED,
          deletedAt: new Date('2026-07-22T10:00:00.000Z'),
        },
        {
          id: readyDocumentId,
          userId: ownerId,
          name: 'Ready.pdf',
          storageKey: `tests/${readyDocumentId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 300n,
          fileHash: `hash-${readyDocumentId}`,
          status: DocumentStatus.READY,
        },
        {
          id: processingDocumentId,
          userId: ownerId,
          name: 'Processing.pdf',
          storageKey: `tests/${processingDocumentId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 400n,
          fileHash: `hash-${processingDocumentId}`,
          status: DocumentStatus.PROCESSING,
        },
      ],
    });
    await prisma.documentChunk.createMany({
      data: [
        {
          documentId: failedDocumentId,
          position: 0,
          content: 'Old partially processed content',
          tokenCount: 4,
          embeddingModel: 'text-embedding-3-small',
          embeddingDimensions: 1536,
        },
        {
          documentId: failedDocumentId,
          position: 1,
          content: 'Another old chunk',
          tokenCount: 3,
        },
      ],
    });

    await context.test('requires authentication', async () => {
      assert.deepEqual(await request(failedDocumentId, false), {
        status: 401,
        body: {
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication is required',
          },
        },
      });
    });

    await context.test('hides foreign, missing, and soft-deleted documents', async () => {
      assert.deepEqual(await request(foreignDocumentId), notFoundResponse);
      assert.deepEqual(await request(missingDocumentId), notFoundResponse);
      assert.deepEqual(await request(deletedDocumentId), notFoundResponse);
    });

    await context.test('rejects READY and PROCESSING documents', async () => {
      const invalidStateResponse = {
        status: 409,
        body: {
          error: {
            code: 'INVALID_DOCUMENT_STATE',
            message: 'Only failed documents can be retried.',
          },
        },
      };

      assert.deepEqual(await request(readyDocumentId), invalidStateResponse);
      assert.deepEqual(await request(processingDocumentId), invalidStateResponse);
    });

    await context.test('uses existing route-parameter validation', async () => {
      assert.deepEqual(await request('contains%20spaces'), {
        status: 400,
        body: {
          error: {
            code: 'INVALID_INPUT',
            message: 'Document ID is invalid',
          },
        },
      });
    });

    await context.test(
      'resets state, removes previous artifacts, and creates one processing job',
      async () => {
        const response = await request(failedDocumentId);

        assert.equal(response.status, 202);
        const document = (response.body as { data: { document: Record<string, unknown> } }).data
          .document;
        assert.equal(document.id, failedDocumentId);
        assert.equal(document.filename, 'Authentication Guide.pdf');
        assert.equal(document.processingState, DocumentStatus.PROCESSING);
        assert.equal(document.processingError, null);
        assert.equal(document.processedAt, null);

        for (const forbiddenField of [
          'userId',
          'storageKey',
          'fileHash',
          'chunks',
          'embeddings',
          'queueJobId',
        ]) {
          assert.equal(Object.hasOwn(document, forbiddenField), false);
        }

        assert.deepEqual(
          await prisma.document.findUniqueOrThrow({
            where: { id: failedDocumentId },
            select: { status: true, processingError: true, processedAt: true },
          }),
          {
            status: DocumentStatus.PROCESSING,
            processingError: null,
            processedAt: null,
          },
        );
        assert.equal(
          await prisma.documentChunk.count({ where: { documentId: failedDocumentId } }),
          0,
        );

        const jobs = await processingJobsForDocument();
        assert.equal(jobs.length, 1);
        assert.equal(jobs[0]?.name, DOCUMENT_PROCESSING_JOB_NAME);
        assert.deepEqual(jobs[0]?.data, { documentId: failedDocumentId, userId: ownerId });
        assert.match(jobs[0]?.id ?? '', /^manual-retry-/);

        assert.deepEqual(await request(failedDocumentId), {
          status: 409,
          body: {
            error: {
              code: 'INVALID_DOCUMENT_STATE',
              message: 'Only failed documents can be retried.',
            },
          },
        });
        assert.equal((await processingJobsForDocument()).length, 1);
      },
    );
  } finally {
    for (const job of await processingJobsForDocument()) {
      await job.remove();
    }
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, foreignOwnerId] } } });
    await closeServer(server);
    await closeDocumentProcessingQueue();
    await disconnectPrisma();
  }
});
