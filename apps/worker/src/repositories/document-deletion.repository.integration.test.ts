import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { DocumentStatus } from '../../../../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import {
  findDocumentForDeletion,
  permanentlyDeleteDocumentData,
} from './document-deletion.repository.js';

test('permanent cleanup removes chunks, vectors, and the soft-deleted document idempotently', async () => {
  const suffix = randomUUID();
  const userId = `cleanup-owner-${suffix}`;
  const documentId = `cleanup-document-${suffix}`;
  const chunkId = `cleanup-chunk-${suffix}`;
  const deletedAt = new Date('2026-07-22T18:00:00.000Z');
  const vectorLiteral = `[${Array.from({ length: 1536 }, () => 0.1).join(',')}]`;

  try {
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        passwordHash: 'test-only',
      },
    });
    await prisma.document.create({
      data: {
        id: documentId,
        userId,
        name: 'Cleanup.pdf',
        storageKey: `tests/${documentId}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 100n,
        fileHash: `hash-${documentId}`,
        status: DocumentStatus.READY,
        deletedAt,
      },
    });
    await prisma.documentChunk.create({
      data: {
        id: chunkId,
        documentId,
        position: 0,
        content: 'Content to remove',
        embeddingModel: 'text-embedding-3-small',
        embeddingDimensions: 1536,
      },
    });
    await prisma.$executeRaw`
      UPDATE "DocumentChunk"
      SET "embedding" = ${vectorLiteral}::vector(1536)
      WHERE "id" = ${chunkId}
    `;

    assert.ok(await findDocumentForDeletion(documentId, userId));
    assert.equal(await permanentlyDeleteDocumentData(documentId, userId, deletedAt), true);
    assert.equal(await prisma.document.findUnique({ where: { id: documentId } }), null);
    assert.equal(await prisma.documentChunk.findUnique({ where: { id: chunkId } }), null);
    assert.equal(await permanentlyDeleteDocumentData(documentId, userId, deletedAt), false);
  } finally {
    await prisma.user.deleteMany({ where: { id: userId } });
  }
});

test('a forged owner payload cannot discover or clean up another user document', async () => {
  const suffix = randomUUID();
  const userAId = `cleanup-forged-owner-${suffix}`;
  const userBId = `cleanup-real-owner-${suffix}`;
  const documentId = `cleanup-foreign-document-${suffix}`;
  const chunkId = `cleanup-foreign-chunk-${suffix}`;
  const deletedAt = new Date('2026-08-20T10:00:00.000Z');
  const vectorLiteral = `[${Array.from({ length: 1536 }, () => 0.1).join(',')}]`;

  try {
    await prisma.user.createMany({
      data: [
        {
          id: userAId,
          email: `${userAId}@example.com`,
          passwordHash: 'test-only',
        },
        {
          id: userBId,
          email: `${userBId}@example.com`,
          passwordHash: 'test-only',
        },
      ],
    });
    await prisma.document.create({
      data: {
        id: documentId,
        userId: userBId,
        name: 'Foreign Cleanup.pdf',
        storageKey: `tests/${documentId}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 100n,
        fileHash: `hash-${documentId}`,
        status: DocumentStatus.READY,
        deletedAt,
      },
    });
    await prisma.documentChunk.create({
      data: {
        id: chunkId,
        documentId,
        position: 0,
        content: 'Foreign content and vector must remain untouched.',
        embeddingModel: 'text-embedding-3-small',
        embeddingDimensions: 1536,
      },
    });
    await prisma.$executeRaw`
      UPDATE "DocumentChunk"
      SET "embedding" = ${vectorLiteral}::vector(1536)
      WHERE "id" = ${chunkId}
    `;

    assert.equal(await findDocumentForDeletion(documentId, userAId), null);
    assert.equal(await permanentlyDeleteDocumentData(documentId, userAId, deletedAt), false);
    assert.ok(await prisma.document.findUnique({ where: { id: documentId } }));
    assert.ok(await prisma.documentChunk.findUnique({ where: { id: chunkId } }));

    const storedVectors = await prisma.$queryRaw<Array<{ hasEmbedding: boolean }>>`
      SELECT ("embedding" IS NOT NULL) AS "hasEmbedding"
      FROM "DocumentChunk"
      WHERE "id" = ${chunkId}
    `;
    assert.deepEqual(storedVectors, [{ hasEmbedding: true }]);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
  }
});
