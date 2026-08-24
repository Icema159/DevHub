import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { DocumentStatus } from '../../../../generated/prisma/client.js';
import { RESOURCE_LIMITS } from '../config/resource-limits.js';
import { disconnectPrisma, prisma } from '../config/prisma.js';
import {
  releaseDocumentQuotaReservation,
  reserveDocumentUpload,
} from './resource-quota.repository.js';

test('document, storage, and processing quotas are owner-scoped and atomic', async () => {
  const suffix = randomUUID();
  const userId = `quota-owner-${suffix}`;
  const foreignUserId = `quota-foreign-${suffix}`;

  try {
    await prisma.user.createMany({
      data: [
        { id: userId, email: `${userId}@example.com`, passwordHash: 'test-only' },
        { id: foreignUserId, email: `${foreignUserId}@example.com`, passwordHash: 'test-only' },
      ],
    });
    await prisma.document.createMany({
      data: Array.from({ length: 24 }, (_, index) => ({
        id: `quota-document-${index}-${suffix}`,
        userId,
        name: `Document ${index}.pdf`,
        storageKey: `tests/quota-${index}-${suffix}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1n,
        fileHash: `quota-hash-${index}-${suffix}`,
        status: DocumentStatus.READY,
      })),
    });
    await prisma.document.create({
      data: {
        id: `quota-foreign-document-${suffix}`,
        userId: foreignUserId,
        name: 'Foreign.pdf',
        storageKey: `tests/quota-foreign-${suffix}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: RESOURCE_LIMITS.perUserStorageBytes,
        fileHash: `quota-foreign-hash-${suffix}`,
        status: DocumentStatus.PROCESSING,
      },
    });

    const simultaneous = await Promise.all([
      reserveDocumentUpload(userId, 1n),
      reserveDocumentUpload(userId, 1n),
    ]);
    assert.equal(simultaneous.filter((result) => result.allowed).length, 1);
    assert.equal(
      simultaneous.some((result) => !result.allowed && result.reason === 'DOCUMENT_LIMIT_REACHED'),
      true,
    );

    const allowed = simultaneous.find((result) => result.allowed);
    if (allowed?.allowed) await releaseDocumentQuotaReservation(allowed.reservationId, userId);

    await prisma.document.deleteMany({ where: { userId } });
    await prisma.document.create({
      data: {
        id: `quota-storage-${suffix}`,
        userId,
        name: 'Storage.pdf',
        storageKey: `tests/quota-storage-${suffix}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: RESOURCE_LIMITS.perUserStorageBytes - 1n,
        fileHash: `quota-storage-hash-${suffix}`,
        status: DocumentStatus.READY,
      },
    });
    const exactBoundary = await reserveDocumentUpload(userId, 1n);
    assert.equal(exactBoundary.allowed, true);
    const crossingBoundary = await reserveDocumentUpload(userId, 1n);
    assert.deepEqual(crossingBoundary, { allowed: false, reason: 'STORAGE_LIMIT_REACHED' });
    if (exactBoundary.allowed) {
      await releaseDocumentQuotaReservation(exactBoundary.reservationId, userId);
    }

    await prisma.document.deleteMany({ where: { userId } });
    await prisma.document.createMany({
      data: [DocumentStatus.PENDING, DocumentStatus.EMBEDDING].map((status, index) => ({
        id: `quota-processing-${index}-${suffix}`,
        userId,
        name: `Processing ${index}.pdf`,
        storageKey: `tests/quota-processing-${index}-${suffix}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1n,
        fileHash: `quota-processing-hash-${index}-${suffix}`,
        status,
      })),
    });
    assert.deepEqual(await reserveDocumentUpload(userId, 1n), {
      allowed: false,
      reason: 'PROCESSING_LIMIT_REACHED',
    });

    await prisma.document.updateMany({ where: { userId }, data: { deletedAt: new Date() } });
    const afterSoftDelete = await reserveDocumentUpload(userId, 1n);
    assert.equal(afterSoftDelete.allowed, true);
    if (afterSoftDelete.allowed) {
      await releaseDocumentQuotaReservation(afterSoftDelete.reservationId, userId);
    }
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [userId, foreignUserId] } } });
    await disconnectPrisma();
  }
});

test('expired upload reservations stop consuming capacity', async () => {
  const suffix = randomUUID();
  const userId = `quota-stale-${suffix}`;

  try {
    await prisma.user.create({
      data: { id: userId, email: `${userId}@example.com`, passwordHash: 'test-only' },
    });
    await prisma.documentQuotaReservation.create({
      data: {
        userId,
        purpose: 'UPLOAD',
        documentCount: RESOURCE_LIMITS.perUserDocuments,
        storageBytes: RESOURCE_LIMITS.perUserStorageBytes,
        processingSlots: RESOURCE_LIMITS.perUserProcessingPipelines,
        expiresAt: new Date(Date.now() - 1_000),
      },
    });

    const decision = await reserveDocumentUpload(userId, 1n);
    assert.equal(decision.allowed, true);
    if (decision.allowed) await releaseDocumentQuotaReservation(decision.reservationId, userId);
  } finally {
    await prisma.user.deleteMany({ where: { id: userId } });
    await disconnectPrisma();
  }
});
