import {
  DocumentQuotaReservationPurpose,
  DocumentStatus,
  Prisma,
} from '../../../../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import { checkDocumentQuotaInTransaction, lockQuotaOwner } from './resource-quota.repository.js';

const publicDocumentSelect = {
  id: true,
  name: true,
  mimeType: true,
  sizeBytes: true,
  status: true,
  processedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const documentDetailSelect = {
  id: true,
  name: true,
  mimeType: true,
  sizeBytes: true,
  status: true,
  processingError: true,
  processedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type DocumentRecord = Prisma.DocumentGetPayload<{
  select: typeof publicDocumentSelect;
}>;

export type DocumentDetailRecord = Prisma.DocumentGetPayload<{
  select: typeof documentDetailSelect;
}>;

export interface CreateDocumentInput {
  userId: string;
  name: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: bigint;
  fileHash: string;
}

export interface FindDocumentPageInput {
  userId: string;
  page: number;
  limit: number;
  search: string | undefined;
  processingStates: DocumentStatus[] | undefined;
}

export interface DocumentStatusCountRecord {
  status: DocumentStatus;
  count: number;
}

export interface DocumentPageRecord {
  documents: DocumentRecord[];
  total: number;
  statusCounts: DocumentStatusCountRecord[];
}

export type RestartFailedDocumentResult =
  | {
      outcome: 'restarted';
      document: DocumentDetailRecord;
      previousProcessingError: string | null;
      previousProcessedAt: Date | null;
      retryStartedAt: Date;
    }
  | { outcome: 'not-found' }
  | { outcome: 'invalid-state'; status: DocumentStatus }
  | { outcome: 'processing-limit' };

export class DuplicateDocumentError extends Error {
  constructor() {
    super('Document file already exists for this user');
    this.name = 'DuplicateDocumentError';
  }
}

export class DocumentQuotaExceededError extends Error {
  constructor(
    readonly reason:
      'DOCUMENT_LIMIT_REACHED' | 'STORAGE_LIMIT_REACHED' | 'PROCESSING_LIMIT_REACHED',
  ) {
    super(reason);
    this.name = 'DocumentQuotaExceededError';
  }
}

function isUserFileHashConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }

  const target = error.meta?.target;

  return Array.isArray(target) && target.includes('userId') && target.includes('fileHash');
}

export async function findDuplicateDocument(userId: string, fileHash: string): Promise<boolean> {
  const document = await prisma.document.findFirst({
    where: {
      userId,
      fileHash,
      deletedAt: null,
    },
    select: { id: true },
  });

  return document !== null;
}

export async function createDocument(input: CreateDocumentInput): Promise<DocumentRecord> {
  try {
    return await prisma.document.create({
      data: {
        ...input,
        status: DocumentStatus.PENDING,
      },
      select: publicDocumentSelect,
    });
  } catch (error) {
    if (isUserFileHashConflict(error)) {
      throw new DuplicateDocumentError();
    }

    throw error;
  }
}

export async function createDocumentFromUploadReservation(
  input: CreateDocumentInput,
  reservationId: string,
  now = new Date(),
): Promise<DocumentRecord> {
  try {
    return await prisma.$transaction(async (transaction) => {
      if (!(await lockQuotaOwner(transaction, input.userId))) {
        throw new Error('Quota owner no longer exists');
      }

      const reservation = await transaction.documentQuotaReservation.findFirst({
        where: {
          id: reservationId,
          userId: input.userId,
          purpose: DocumentQuotaReservationPurpose.UPLOAD,
        },
      });

      if (!reservation) {
        throw new Error('Document upload reservation is unavailable');
      }

      if (reservation.expiresAt <= now) {
        const reason = await checkDocumentQuotaInTransaction(
          transaction,
          input.userId,
          {
            documentCount: reservation.documentCount,
            storageBytes: reservation.storageBytes,
            processingSlots: reservation.processingSlots,
          },
          now,
          reservation.id,
        );

        if (reason) {
          throw new DocumentQuotaExceededError(reason);
        }
      }

      const document = await transaction.document.create({
        data: { ...input, status: DocumentStatus.PENDING },
        select: publicDocumentSelect,
      });
      await transaction.documentQuotaReservation.delete({ where: { id: reservation.id } });

      return document;
    });
  } catch (error) {
    if (isUserFileHashConflict(error)) throw new DuplicateDocumentError();
    throw error;
  }
}

function ownerSearchWhere(userId: string, search: string | undefined): Prisma.DocumentWhereInput {
  return {
    userId,
    deletedAt: null,
    ...(search
      ? {
          name: {
            contains: search,
            mode: 'insensitive' as const,
          },
        }
      : {}),
  };
}

export async function findDocumentPageByUserId(
  input: FindDocumentPageInput,
): Promise<DocumentPageRecord> {
  const ownerAndSearchWhere = ownerSearchWhere(input.userId, input.search);
  const filteredWhere: Prisma.DocumentWhereInput = {
    ...ownerAndSearchWhere,
    ...(input.processingStates
      ? {
          status: { in: input.processingStates },
        }
      : {}),
  };
  const [documents, total, groupedStatusCounts] = await Promise.all([
    prisma.document.findMany({
      where: filteredWhere,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      select: publicDocumentSelect,
    }),
    prisma.document.count({ where: filteredWhere }),
    prisma.document.groupBy({
      by: ['status'],
      where: ownerAndSearchWhere,
      _count: { _all: true },
    }),
  ]);

  return {
    documents,
    total,
    statusCounts: groupedStatusCounts.map((entry) => ({
      status: entry.status,
      count: entry._count._all,
    })),
  };
}

export async function findDocumentDetailByIdForUser(
  documentId: string,
  userId: string,
): Promise<DocumentDetailRecord | null> {
  return prisma.document.findFirst({
    where: {
      id: documentId,
      userId,
      deletedAt: null,
    },
    select: documentDetailSelect,
  });
}

export async function deletePendingDocumentByIdForUser(
  documentId: string,
  userId: string,
): Promise<boolean> {
  const result = await prisma.document.deleteMany({
    where: {
      id: documentId,
      userId,
      status: DocumentStatus.PENDING,
      deletedAt: null,
    },
  });

  return result.count === 1;
}

export async function softDeleteDocumentByIdForUser(
  documentId: string,
  userId: string,
  deletedAt: Date,
): Promise<boolean> {
  const result = await prisma.document.updateMany({
    where: {
      id: documentId,
      userId,
      deletedAt: null,
    },
    data: { deletedAt },
  });

  return result.count === 1;
}

export async function restoreDocumentAfterDeletionQueueFailure(
  documentId: string,
  userId: string,
  deletedAt: Date,
): Promise<boolean> {
  const result = await prisma.document.updateMany({
    where: {
      id: documentId,
      userId,
      deletedAt,
    },
    data: { deletedAt: null },
  });

  return result.count === 1;
}

export async function restartFailedDocumentByIdForUser(
  documentId: string,
  userId: string,
  retryStartedAt: Date,
): Promise<RestartFailedDocumentResult> {
  return prisma.$transaction(async (transaction) => {
    if (!(await lockQuotaOwner(transaction, userId))) {
      return { outcome: 'not-found' };
    }

    const document = await transaction.document.findFirst({
      where: {
        id: documentId,
        userId,
        deletedAt: null,
      },
      select: documentDetailSelect,
    });

    if (!document) {
      return { outcome: 'not-found' };
    }

    if (document.status !== DocumentStatus.FAILED) {
      return { outcome: 'invalid-state', status: document.status };
    }

    const quotaReason = await checkDocumentQuotaInTransaction(
      transaction,
      userId,
      { documentCount: 0, storageBytes: 0n, processingSlots: 1 },
      retryStartedAt,
    );

    if (quotaReason === 'PROCESSING_LIMIT_REACHED') {
      return { outcome: 'processing-limit' };
    }

    const reset = await transaction.document.updateMany({
      where: {
        id: documentId,
        userId,
        deletedAt: null,
        status: DocumentStatus.FAILED,
        updatedAt: document.updatedAt,
      },
      data: {
        status: DocumentStatus.PROCESSING,
        processingError: null,
        processedAt: null,
        updatedAt: retryStartedAt,
      },
    });

    if (reset.count !== 1) {
      const currentDocument = await transaction.document.findFirst({
        where: {
          id: documentId,
          userId,
          deletedAt: null,
        },
        select: { status: true },
      });

      return currentDocument
        ? { outcome: 'invalid-state', status: currentDocument.status }
        : { outcome: 'not-found' };
    }

    await transaction.documentChunk.deleteMany({
      where: { documentId },
    });

    const restartedDocument = await transaction.document.findUniqueOrThrow({
      where: { id: documentId },
      select: documentDetailSelect,
    });

    return {
      outcome: 'restarted',
      document: restartedDocument,
      previousProcessingError: document.processingError,
      previousProcessedAt: document.processedAt,
      retryStartedAt,
    };
  });
}

export async function restoreFailedDocumentAfterRetryQueueFailure(
  documentId: string,
  userId: string,
  retryStartedAt: Date,
  processingError: string | null,
  processedAt: Date | null,
): Promise<boolean> {
  const result = await prisma.document.updateMany({
    where: {
      id: documentId,
      userId,
      deletedAt: null,
      status: DocumentStatus.PROCESSING,
      updatedAt: retryStartedAt,
    },
    data: {
      status: DocumentStatus.FAILED,
      processingError,
      processedAt,
    },
  });

  return result.count === 1;
}
