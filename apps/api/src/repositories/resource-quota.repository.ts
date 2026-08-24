import {
  DocumentQuotaReservationPurpose,
  DocumentStatus,
  Prisma,
} from '../../../../generated/prisma/client.js';

import { RESOURCE_LIMITS } from '../config/resource-limits.js';
import { prisma } from '../config/prisma.js';

const ACTIVE_PROCESSING_STATES = [
  DocumentStatus.PENDING,
  DocumentStatus.PROCESSING,
  DocumentStatus.CHUNKS_READY,
  DocumentStatus.EMBEDDING,
] as const;

export type DocumentQuotaDenial =
  'DOCUMENT_LIMIT_REACHED' | 'STORAGE_LIMIT_REACHED' | 'PROCESSING_LIMIT_REACHED';

export type DocumentQuotaReservationResult =
  { allowed: true; reservationId: string } | { allowed: false; reason: DocumentQuotaDenial };

interface QuotaIncrement {
  documentCount: number;
  storageBytes: bigint;
  processingSlots: number;
}

export async function lockQuotaOwner(
  transaction: Prisma.TransactionClient,
  userId: string,
): Promise<boolean> {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`,
  );

  return rows.length === 1;
}

async function removeExpiredReservations(
  transaction: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<void> {
  await transaction.documentQuotaReservation.deleteMany({
    where: { userId, expiresAt: { lte: now } },
  });
}

export async function checkDocumentQuotaInTransaction(
  transaction: Prisma.TransactionClient,
  userId: string,
  increment: QuotaIncrement,
  now: Date,
  excludeReservationId?: string,
): Promise<DocumentQuotaDenial | null> {
  await removeExpiredReservations(transaction, userId, now);

  const [documents, activeProcessing, reservations] = await Promise.all([
    transaction.document.aggregate({
      where: { userId, deletedAt: null },
      _count: { _all: true },
      _sum: { sizeBytes: true },
    }),
    transaction.document.count({
      where: {
        userId,
        deletedAt: null,
        status: { in: [...ACTIVE_PROCESSING_STATES] },
      },
    }),
    transaction.documentQuotaReservation.aggregate({
      where: {
        userId,
        expiresAt: { gt: now },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
      _sum: {
        documentCount: true,
        storageBytes: true,
        processingSlots: true,
      },
    }),
  ]);

  const documentCount =
    documents._count._all + (reservations._sum.documentCount ?? 0) + increment.documentCount;
  if (documentCount > RESOURCE_LIMITS.perUserDocuments) return 'DOCUMENT_LIMIT_REACHED';

  const storageBytes =
    (documents._sum.sizeBytes ?? 0n) +
    (reservations._sum.storageBytes ?? 0n) +
    increment.storageBytes;
  if (storageBytes > RESOURCE_LIMITS.perUserStorageBytes) return 'STORAGE_LIMIT_REACHED';

  const processingSlots =
    activeProcessing + (reservations._sum.processingSlots ?? 0) + increment.processingSlots;
  if (processingSlots > RESOURCE_LIMITS.perUserProcessingPipelines) {
    return 'PROCESSING_LIMIT_REACHED';
  }

  return null;
}

export async function reserveDocumentUpload(
  userId: string,
  sizeBytes: bigint,
  now = new Date(),
): Promise<DocumentQuotaReservationResult> {
  return prisma.$transaction(async (transaction) => {
    if (!(await lockQuotaOwner(transaction, userId))) {
      return { allowed: false as const, reason: 'DOCUMENT_LIMIT_REACHED' as const };
    }

    const reason = await checkDocumentQuotaInTransaction(
      transaction,
      userId,
      { documentCount: 1, storageBytes: sizeBytes, processingSlots: 1 },
      now,
    );

    if (reason) return { allowed: false as const, reason };

    const reservation = await transaction.documentQuotaReservation.create({
      data: {
        userId,
        purpose: DocumentQuotaReservationPurpose.UPLOAD,
        documentCount: 1,
        storageBytes: sizeBytes,
        processingSlots: 1,
        expiresAt: new Date(now.getTime() + RESOURCE_LIMITS.documentReservationTtlMs),
      },
      select: { id: true },
    });

    return { allowed: true as const, reservationId: reservation.id };
  });
}

export async function releaseDocumentQuotaReservation(
  reservationId: string,
  userId: string,
): Promise<void> {
  await prisma.documentQuotaReservation.deleteMany({ where: { id: reservationId, userId } });
}

export interface DeleteQuotaHold {
  reservationId: string;
}

export async function softDeleteWithQuotaHold(
  documentId: string,
  userId: string,
  deletedAt: Date,
): Promise<DeleteQuotaHold | null> {
  return prisma.$transaction(async (transaction) => {
    if (!(await lockQuotaOwner(transaction, userId))) return null;

    const document = await transaction.document.findFirst({
      where: { id: documentId, userId, deletedAt: null },
      select: { id: true, sizeBytes: true, status: true },
    });

    if (!document) return null;

    const hold = await transaction.documentQuotaReservation.create({
      data: {
        userId,
        purpose: DocumentQuotaReservationPurpose.DELETE_ROLLBACK,
        documentCount: 1,
        storageBytes: document.sizeBytes,
        processingSlots: ACTIVE_PROCESSING_STATES.includes(
          document.status as (typeof ACTIVE_PROCESSING_STATES)[number],
        )
          ? 1
          : 0,
        expiresAt: new Date(deletedAt.getTime() + RESOURCE_LIMITS.documentReservationTtlMs),
      },
      select: { id: true },
    });
    const updated = await transaction.document.updateMany({
      where: { id: documentId, userId, deletedAt: null },
      data: { deletedAt },
    });

    if (updated.count !== 1) {
      throw new Error('Document changed during soft-delete admission');
    }

    return { reservationId: hold.id };
  });
}

export async function restoreDeletedDocumentAndReleaseHold(
  documentId: string,
  userId: string,
  deletedAt: Date,
  reservationId: string,
): Promise<boolean> {
  return prisma.$transaction(async (transaction) => {
    if (!(await lockQuotaOwner(transaction, userId))) return false;

    const hold = await transaction.documentQuotaReservation.findFirst({
      where: {
        id: reservationId,
        userId,
        purpose: DocumentQuotaReservationPurpose.DELETE_ROLLBACK,
      },
    });

    if (!hold) return false;

    if (hold.expiresAt <= new Date()) {
      const reason = await checkDocumentQuotaInTransaction(
        transaction,
        userId,
        {
          documentCount: hold.documentCount,
          storageBytes: hold.storageBytes,
          processingSlots: hold.processingSlots,
        },
        new Date(),
        hold.id,
      );
      if (reason) return false;
    }

    const restored = await transaction.document.updateMany({
      where: { id: documentId, userId, deletedAt },
      data: { deletedAt: null },
    });
    await transaction.documentQuotaReservation.deleteMany({ where: { id: hold.id } });

    return restored.count === 1;
  });
}
