import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { DocumentStatus } from '../../../../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import {
  markDocumentProcessingFailed,
  transitionDocumentToProcessing,
} from './document.repository.js';
import {
  markDocumentEmbeddingFailed,
  transitionDocumentToEmbedding,
} from './embedding.repository.js';

test('worker repositories clear stale errors and persist terminal failures idempotently', async () => {
  const suffix = randomUUID();
  const userId = `worker-retry-owner-${suffix}`;
  const processingId = `worker-processing-${suffix}`;
  const chunksReadyId = `worker-chunks-ready-${suffix}`;
  const embeddingId = `worker-embedding-${suffix}`;

  try {
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        passwordHash: 'test-only',
      },
    });
    await prisma.document.createMany({
      data: [
        {
          id: processingId,
          userId,
          name: 'Processing.pdf',
          storageKey: `tests/${processingId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 1n,
          fileHash: `hash-${processingId}`,
          status: DocumentStatus.PENDING,
          processingError: 'stale error',
          processedAt: new Date('2026-07-22T10:00:00.000Z'),
        },
        {
          id: chunksReadyId,
          userId,
          name: 'Chunks ready.pdf',
          storageKey: `tests/${chunksReadyId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 2n,
          fileHash: `hash-${chunksReadyId}`,
          status: DocumentStatus.CHUNKS_READY,
        },
        {
          id: embeddingId,
          userId,
          name: 'Embedding.pdf',
          storageKey: `tests/${embeddingId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 3n,
          fileHash: `hash-${embeddingId}`,
          status: DocumentStatus.CHUNKS_READY,
          processingError: 'stale error',
          processedAt: new Date('2026-07-22T10:00:00.000Z'),
        },
      ],
    });

    assert.equal(await transitionDocumentToProcessing(processingId, userId), true);
    assert.deepEqual(
      await prisma.document.findUniqueOrThrow({
        where: { id: processingId },
        select: { status: true, processingError: true, processedAt: true },
      }),
      {
        status: DocumentStatus.PROCESSING,
        processingError: null,
        processedAt: null,
      },
    );

    assert.equal(
      await markDocumentProcessingFailed(
        processingId,
        userId,
        'Document processing failed during file retrieval or text extraction',
      ),
      true,
    );
    assert.equal(
      await markDocumentProcessingFailed(processingId, userId, 'must not replace safe error'),
      false,
    );
    assert.deepEqual(
      await prisma.document.findUniqueOrThrow({
        where: { id: processingId },
        select: { status: true, processingError: true, processedAt: true },
      }),
      {
        status: DocumentStatus.FAILED,
        processingError: 'Document processing failed during file retrieval or text extraction',
        processedAt: null,
      },
    );

    assert.equal(
      await markDocumentProcessingFailed(
        chunksReadyId,
        userId,
        'Document processing failed during file retrieval or text extraction',
      ),
      true,
    );

    assert.equal(await transitionDocumentToEmbedding(embeddingId, userId), true);
    assert.deepEqual(
      await prisma.document.findUniqueOrThrow({
        where: { id: embeddingId },
        select: { status: true, processingError: true, processedAt: true },
      }),
      {
        status: DocumentStatus.EMBEDDING,
        processingError: null,
        processedAt: null,
      },
    );

    assert.equal(
      await markDocumentEmbeddingFailed(
        embeddingId,
        userId,
        'Document embedding generation failed',
      ),
      true,
    );
    assert.equal(
      await markDocumentEmbeddingFailed(embeddingId, userId, 'must not replace safe error'),
      false,
    );
    assert.deepEqual(
      await prisma.document.findUniqueOrThrow({
        where: { id: embeddingId },
        select: { status: true, processingError: true, processedAt: true },
      }),
      {
        status: DocumentStatus.FAILED,
        processingError: 'Document embedding generation failed',
        processedAt: null,
      },
    );
  } finally {
    await prisma.user.deleteMany({ where: { id: userId } });
  }
});
