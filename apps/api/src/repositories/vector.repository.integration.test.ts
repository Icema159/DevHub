import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { DocumentStatus } from '../../../../generated/prisma/client.js';
import { disconnectPrisma, prisma } from '../config/prisma.js';
import { searchChunksByCosineSimilarity } from './vector.repository.js';

const embeddingModel = 'text-embedding-3-small';
const embeddingDimensions = 1536;

test('semantic retrieval filters foreign, soft-deleted, and non-ready vectors before ranking', async () => {
  const suffix = randomUUID();
  const userAId = `vector-owner-a-${suffix}`;
  const userBId = `vector-owner-b-${suffix}`;
  const activeDocumentId = `vector-active-${suffix}`;
  const deletedDocumentId = `vector-deleted-${suffix}`;
  const nonReadyDocumentId = `vector-non-ready-${suffix}`;
  const foreignDocumentId = `vector-foreign-${suffix}`;
  const activeChunkId = `vector-active-chunk-${suffix}`;
  const deletedChunkId = `vector-deleted-chunk-${suffix}`;
  const nonReadyChunkId = `vector-non-ready-chunk-${suffix}`;
  const foreignChunkId = `vector-foreign-chunk-${suffix}`;
  const queryVector = [1, ...Array.from({ length: embeddingDimensions - 1 }, () => 0)];
  const fartherOwnerVector = [
    0.8,
    0.6,
    ...Array.from({ length: embeddingDimensions - 2 }, () => 0),
  ];
  const queryVectorLiteral = `[${queryVector.join(',')}]`;
  const fartherOwnerVectorLiteral = `[${fartherOwnerVector.join(',')}]`;

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
    await prisma.document.createMany({
      data: [
        {
          id: activeDocumentId,
          userId: userAId,
          name: 'Active.pdf',
          storageKey: `tests/${activeDocumentId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 100n,
          fileHash: `hash-${activeDocumentId}`,
          status: DocumentStatus.READY,
        },
        {
          id: deletedDocumentId,
          userId: userAId,
          name: 'Deleted.pdf',
          storageKey: `tests/${deletedDocumentId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 200n,
          fileHash: `hash-${deletedDocumentId}`,
          status: DocumentStatus.READY,
          deletedAt: new Date(),
        },
        {
          id: nonReadyDocumentId,
          userId: userAId,
          name: 'Processing.pdf',
          storageKey: `tests/${nonReadyDocumentId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 300n,
          fileHash: `hash-${nonReadyDocumentId}`,
          status: DocumentStatus.PROCESSING,
        },
        {
          id: foreignDocumentId,
          userId: userBId,
          name: 'Foreign.pdf',
          storageKey: `tests/${foreignDocumentId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 400n,
          fileHash: `hash-${foreignDocumentId}`,
          status: DocumentStatus.READY,
        },
      ],
    });
    await prisma.documentChunk.createMany({
      data: [
        {
          id: activeChunkId,
          documentId: activeDocumentId,
          position: 0,
          content: 'Visible semantic result',
          embeddingModel,
          embeddingDimensions,
        },
        {
          id: deletedChunkId,
          documentId: deletedDocumentId,
          position: 0,
          content: 'Deleted semantic result',
          embeddingModel,
          embeddingDimensions,
        },
        {
          id: nonReadyChunkId,
          documentId: nonReadyDocumentId,
          position: 0,
          content: 'Closer non-ready semantic result',
          embeddingModel,
          embeddingDimensions,
        },
        {
          id: foreignChunkId,
          documentId: foreignDocumentId,
          position: 0,
          content: 'Closest foreign semantic result',
          embeddingModel,
          embeddingDimensions,
        },
      ],
    });
    await prisma.$executeRaw`
      UPDATE "DocumentChunk"
      SET "embedding" = ${fartherOwnerVectorLiteral}::vector(1536)
      WHERE "id" = ${activeChunkId}
    `;
    await prisma.$executeRaw`
      UPDATE "DocumentChunk"
      SET "embedding" = ${queryVectorLiteral}::vector(1536)
      WHERE "id" IN (${deletedChunkId}, ${nonReadyChunkId}, ${foreignChunkId})
    `;

    const userAResults = await searchChunksByCosineSimilarity({
      userId: userAId,
      embedding: queryVector,
      embeddingModel,
      embeddingDimensions,
    });

    assert.deepEqual(
      userAResults.map((result) => result.documentId),
      [activeDocumentId],
    );
    assert.equal(userAResults[0]?.content, 'Visible semantic result');

    const userBResults = await searchChunksByCosineSimilarity({
      userId: userBId,
      embedding: queryVector,
      embeddingModel,
      embeddingDimensions,
    });

    assert.deepEqual(
      userBResults.map((result) => result.documentId),
      [foreignDocumentId],
    );
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await disconnectPrisma();
  }
});
