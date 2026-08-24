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

interface DocumentSummaryResponse {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  processingState: string;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
}

interface DocumentListResponseBody {
  data: {
    documents: DocumentSummaryResponse[];
  };
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    statusCounts: {
      all: number;
      ready: number;
      processing: number;
      failed: number;
    };
  };
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

test('GET /api/documents supports owner-scoped filtering, pagination, counts, and canonical DTOs', async (context) => {
  const suffix = randomUUID();
  const ownerId = `list-owner-${suffix}`;
  const foreignOwnerId = `list-foreign-owner-${suffix}`;
  const ownerEmail = `${ownerId}@example.com`;
  const sameNewestTimestamp = new Date('2026-07-22T12:00:00.000Z');
  const documents = [
    {
      id: `list-sort-z-${suffix}`,
      name: 'Newest Z.pdf',
      status: DocumentStatus.READY,
      createdAt: sameNewestTimestamp,
    },
    {
      id: `list-sort-a-${suffix}`,
      name: 'Newest A.pdf',
      status: DocumentStatus.READY,
      createdAt: sameNewestTimestamp,
    },
    {
      id: `list-auth-ready-${suffix}`,
      name: 'Authentication Ready.pdf',
      status: DocumentStatus.READY,
      createdAt: new Date('2026-07-21T12:00:00.000Z'),
    },
    {
      id: `list-auth-failed-${suffix}`,
      name: 'auth Failed.pdf',
      status: DocumentStatus.FAILED,
      createdAt: new Date('2026-07-20T12:00:00.000Z'),
    },
    {
      id: `list-auth-pending-${suffix}`,
      name: 'AUTH Pending.pdf',
      status: DocumentStatus.PENDING,
      createdAt: new Date('2026-07-19T12:00:00.000Z'),
    },
    {
      id: `list-auth-processing-${suffix}`,
      name: 'Auth Processing.pdf',
      status: DocumentStatus.PROCESSING,
      createdAt: new Date('2026-07-18T12:00:00.000Z'),
    },
    {
      id: `list-auth-chunks-${suffix}`,
      name: 'Auth Chunks.pdf',
      status: DocumentStatus.CHUNKS_READY,
      createdAt: new Date('2026-07-17T12:00:00.000Z'),
    },
    {
      id: `list-auth-embedding-${suffix}`,
      name: 'Auth Embedding.pdf',
      status: DocumentStatus.EMBEDDING,
      createdAt: new Date('2026-07-16T12:00:00.000Z'),
    },
    {
      id: `list-notes-${suffix}`,
      name: 'Prisma Notes.pdf',
      status: DocumentStatus.READY,
      createdAt: new Date('2026-07-15T12:00:00.000Z'),
    },
    {
      id: `list-internal-${suffix}`,
      name: 'Ordinary Document.pdf',
      status: DocumentStatus.READY,
      createdAt: new Date('2026-07-14T12:00:00.000Z'),
    },
    {
      id: `list-older-ready-${suffix}`,
      name: 'Older Ready.pdf',
      status: DocumentStatus.READY,
      createdAt: new Date('2026-07-13T12:00:00.000Z'),
    },
    {
      id: `list-oldest-failed-${suffix}`,
      name: 'Oldest Failed.pdf',
      status: DocumentStatus.FAILED,
      createdAt: new Date('2026-07-12T12:00:00.000Z'),
    },
  ];
  const server = app.listen(0, '127.0.0.1');

  await listen(server);

  const address = server.address();

  assert.ok(address && typeof address === 'object');

  const baseUrl = `http://127.0.0.1:${address.port}`;
  let ownerCookieHeader = '';

  async function request(query = '', authenticated = true): Promise<ApiResponse> {
    const response = await fetch(
      `${baseUrl}/api/documents${query}`,
      authenticated ? { headers: { cookie: ownerCookieHeader } } : {},
    );

    return {
      status: response.status,
      body: (await response.json()) as unknown,
    };
  }

  function successfulBody(response: ApiResponse): DocumentListResponseBody {
    assert.equal(response.status, 200);
    return response.body as DocumentListResponseBody;
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
        ...documents.map((document, index) => ({
          ...document,
          userId: ownerId,
          storageKey:
            document.id === `list-internal-${suffix}`
              ? `tests/NeedleInternal-${document.id}.pdf`
              : `tests/${document.id}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: BigInt(1_000 + index),
          fileHash:
            document.id === `list-internal-${suffix}`
              ? `NeedleInternal-hash-${document.id}`
              : `hash-${document.id}`,
          ...(document.id === `list-internal-${suffix}`
            ? { metadata: { internalValue: 'NeedleInternal' } }
            : {}),
        })),
        {
          id: `list-foreign-auth-${suffix}`,
          userId: foreignOwnerId,
          name: 'Auth Foreign.pdf',
          storageKey: `tests/list-foreign-auth-${suffix}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 9_999n,
          fileHash: `hash-list-foreign-auth-${suffix}`,
          status: DocumentStatus.READY,
          createdAt: new Date('2026-07-23T12:00:00.000Z'),
        },
        {
          id: `list-foreign-failed-${suffix}`,
          userId: foreignOwnerId,
          name: 'Foreign Failed.pdf',
          storageKey: `tests/list-foreign-failed-${suffix}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 9_998n,
          fileHash: `hash-list-foreign-failed-${suffix}`,
          status: DocumentStatus.FAILED,
          createdAt: new Date('2026-07-23T11:00:00.000Z'),
        },
        {
          id: `list-deleted-auth-${suffix}`,
          userId: ownerId,
          name: 'Auth Deleted.pdf',
          storageKey: `tests/list-deleted-auth-${suffix}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 9_997n,
          fileHash: `hash-list-deleted-auth-${suffix}`,
          status: DocumentStatus.READY,
          deletedAt: new Date('2026-07-22T13:00:00.000Z'),
          createdAt: new Date('2026-07-23T10:00:00.000Z'),
        },
      ],
    });
    await prisma.documentChunk.create({
      data: {
        documentId: `list-internal-${suffix}`,
        position: 0,
        content: 'NeedleInternal appears only in extracted document content.',
      },
    });

    await context.test('keeps the existing unauthenticated 401 contract', async () => {
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
      'applies defaults, owner scoping, canonical DTOs, and stable newest-first ordering',
      async () => {
        const body = successfulBody(await request());

        assert.deepEqual(body.meta, {
          page: 1,
          limit: 10,
          total: 12,
          totalPages: 2,
          statusCounts: {
            all: 12,
            ready: 6,
            processing: 4,
            failed: 2,
          },
        });
        assert.equal(body.data.documents.length, 10);
        assert.deepEqual(
          body.data.documents.slice(0, 2).map((document) => document.id),
          [`list-sort-z-${suffix}`, `list-sort-a-${suffix}`],
        );
        assert.ok(body.data.documents.every((document) => !document.id.includes('foreign')));
        assert.ok(body.data.documents.every((document) => !document.id.includes('deleted')));

        const firstDocument = body.data.documents[0];

        assert.ok(firstDocument);
        assert.deepEqual(Object.keys(firstDocument).sort(), [
          'createdAt',
          'filename',
          'id',
          'mimeType',
          'processedAt',
          'processingState',
          'size',
          'updatedAt',
        ]);

        for (const forbiddenField of [
          'name',
          'sizeBytes',
          'status',
          'userId',
          'storageKey',
          'fileHash',
          'metadata',
          'chunks',
          'embeddings',
          'embeddingModel',
          'user',
        ]) {
          assert.equal(Object.hasOwn(firstDocument, forbiddenField), false);
        }
      },
    );

    await context.test(
      'returns deterministic pagination metadata and the requested page',
      async () => {
        const body = successfulBody(await request('?page=2&limit=3'));

        assert.deepEqual(
          body.data.documents.map((document) => document.id),
          [
            `list-auth-failed-${suffix}`,
            `list-auth-pending-${suffix}`,
            `list-auth-processing-${suffix}`,
          ],
        );
        assert.equal(body.meta.page, 2);
        assert.equal(body.meta.limit, 3);
        assert.equal(body.meta.total, 12);
        assert.equal(body.meta.totalPages, 4);
      },
    );

    await context.test(
      'searches filename case-insensitively after trimming whitespace',
      async () => {
        const body = successfulBody(await request('?search=%20aUtH%20'));

        assert.equal(body.meta.total, 6);
        assert.ok(
          body.data.documents.every((document) => document.filename.toLowerCase().includes('auth')),
        );
        assert.deepEqual(body.meta.statusCounts, {
          all: 6,
          ready: 1,
          processing: 4,
          failed: 1,
        });
      },
    );

    await context.test('treats empty search as no search', async () => {
      const body = successfulBody(await request('?search=%20%20%20'));

      assert.equal(body.meta.total, 12);
      assert.equal(body.meta.statusCounts.all, 12);
    });

    await context.test(
      'does not search storage, hashes, metadata, or extracted chunks',
      async () => {
        const body = successfulBody(await request('?search=NeedleInternal'));

        assert.deepEqual(body.data.documents, []);
        assert.deepEqual(body.meta, {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          statusCounts: {
            all: 0,
            ready: 0,
            processing: 0,
            failed: 0,
          },
        });
      },
    );

    await context.test('maps READY, FAILED, PROCESSING, and ALL status filters', async () => {
      const ready = successfulBody(await request('?status=READY'));
      const failed = successfulBody(await request('?status=FAILED'));
      const processing = successfulBody(await request('?status=PROCESSING'));
      const all = successfulBody(await request('?status=ALL'));

      assert.equal(ready.meta.total, 6);
      assert.ok(
        ready.data.documents.every((document) => document.processingState === DocumentStatus.READY),
      );
      assert.equal(failed.meta.total, 2);
      assert.ok(
        failed.data.documents.every(
          (document) => document.processingState === DocumentStatus.FAILED,
        ),
      );
      assert.equal(processing.meta.total, 4);
      assert.deepEqual(
        new Set(processing.data.documents.map((document) => document.processingState)),
        new Set([
          DocumentStatus.PENDING,
          DocumentStatus.PROCESSING,
          DocumentStatus.CHUNKS_READY,
          DocumentStatus.EMBEDDING,
        ]),
      );
      assert.equal(all.meta.total, 12);
    });

    await context.test(
      'applies search to counts while ignoring the selected status filter',
      async () => {
        const body = successfulBody(await request('?search=auth&status=FAILED'));

        assert.equal(body.data.documents.length, 1);
        assert.equal(body.data.documents[0]?.processingState, DocumentStatus.FAILED);
        assert.equal(body.meta.total, 1);
        assert.deepEqual(body.meta.statusCounts, {
          all: 6,
          ready: 1,
          processing: 4,
          failed: 1,
        });
        assert.equal(
          body.meta.statusCounts.all,
          body.meta.statusCounts.ready +
            body.meta.statusCounts.processing +
            body.meta.statusCounts.failed,
        );
      },
    );

    await context.test('rejects invalid pagination and unsupported statuses', async () => {
      for (const query of [
        '?page=0',
        '?page=-1',
        '?page=1.5',
        '?limit=0',
        '?limit=101',
        '?limit=ten',
        '?status=ready',
        '?status=UNKNOWN',
      ]) {
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
    await closeDocumentProcessingQueue();
    await disconnectPrisma();
  }
});
