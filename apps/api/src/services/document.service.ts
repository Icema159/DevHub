import { DocumentStatus } from '../../../../generated/prisma/client.js';

import { objectStorage } from '../config/object-storage.js';
import { enqueueDocumentProcessing } from '../queues/document-processing.queue.js';
import {
  createDocumentFromUploadReservation,
  deletePendingDocumentByIdForUser,
  DocumentQuotaExceededError,
  DuplicateDocumentError,
  findDocumentDetailByIdForUser,
  findDocumentPageByUserId,
  findDuplicateDocument,
  type DocumentDetailRecord,
  type DocumentRecord,
} from '../repositories/document.repository.js';
import {
  releaseDocumentQuotaReservation,
  reserveDocumentUpload,
  type DocumentQuotaDenial,
} from '../repositories/resource-quota.repository.js';
import { AppError } from '../utils/app-error.js';
import type { DocumentListQuery, PublicDocumentStatus } from '../utils/document-input.js';
import {
  calculateFileHash,
  validateDocumentName,
  validatePdfContent,
} from '../utils/document-file.js';

export interface DocumentUploadInput {
  userId: string;
  originalName: string;
  mimeType: string;
  content: Buffer;
}

export interface PublicDocument {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentRecord['status'];
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicDocumentSummary {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  processingState: DocumentRecord['status'];
  createdAt: Date;
  updatedAt: Date;
  processedAt: Date | null;
}

export interface PublicDocumentDetail extends PublicDocumentSummary {
  processingError: string | null;
}

export interface PublicDocumentStatusCounts {
  all: number;
  ready: number;
  processing: number;
  failed: number;
}

export interface PublicDocumentListResult {
  documents: PublicDocumentSummary[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    statusCounts: PublicDocumentStatusCounts;
  };
}

const PROCESSING_DOCUMENT_STATES = [
  DocumentStatus.PENDING,
  DocumentStatus.PROCESSING,
  DocumentStatus.CHUNKS_READY,
  DocumentStatus.EMBEDDING,
] as const;

function duplicateDocumentError(): AppError {
  return new AppError(409, 'DUPLICATE_DOCUMENT', 'This PDF has already been uploaded');
}

function documentNotFoundError(): AppError {
  return new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
}

function documentQuotaError(reason: DocumentQuotaDenial): AppError {
  switch (reason) {
    case 'DOCUMENT_LIMIT_REACHED':
      return new AppError(409, reason, "You've reached the document limit for this demo.");
    case 'STORAGE_LIMIT_REACHED':
      return new AppError(409, reason, "You've reached the storage limit for this demo.");
    case 'PROCESSING_LIMIT_REACHED':
      return new AppError(409, reason, 'You already have two documents being processed.');
  }
}

function toPublicDocument(document: DocumentRecord): PublicDocument {
  return {
    ...document,
    sizeBytes: Number(document.sizeBytes),
  };
}

function toPublicDocumentDetail(document: DocumentDetailRecord): PublicDocumentDetail {
  return {
    ...toPublicDocumentSummary(document),
    processingError: document.status === DocumentStatus.FAILED ? document.processingError : null,
  };
}

function toPublicDocumentSummary(document: DocumentRecord): PublicDocumentSummary {
  return {
    id: document.id,
    filename: document.name,
    mimeType: document.mimeType,
    size: Number(document.sizeBytes),
    processingState: document.status,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    processedAt: document.processedAt,
  };
}

function processingStatesForPublicStatus(
  status: PublicDocumentStatus,
): DocumentStatus[] | undefined {
  switch (status) {
    case 'ALL':
      return undefined;
    case 'READY':
      return [DocumentStatus.READY];
    case 'FAILED':
      return [DocumentStatus.FAILED];
    case 'PROCESSING':
      return [...PROCESSING_DOCUMENT_STATES];
  }
}

function toPublicStatusCounts(
  counts: Array<{ status: DocumentStatus; count: number }>,
): PublicDocumentStatusCounts {
  const countByStatus = new Map(counts.map((entry) => [entry.status, entry.count]));
  const ready = countByStatus.get(DocumentStatus.READY) ?? 0;
  const failed = countByStatus.get(DocumentStatus.FAILED) ?? 0;
  const processing = PROCESSING_DOCUMENT_STATES.reduce(
    (total, status) => total + (countByStatus.get(status) ?? 0),
    0,
  );

  return {
    all: ready + processing + failed,
    ready,
    processing,
    failed,
  };
}

async function deleteStoredFileAfterFailure(storageKey: string): Promise<void> {
  try {
    await objectStorage.deleteFile(storageKey);
  } catch (error) {
    console.error('Failed to delete a stored document after upload flow failure', {
      storageKey,
      error,
    });
  }
}

async function compensateQueueFailure(
  documentId: string,
  userId: string,
  storageKey: string,
): Promise<void> {
  try {
    const deleted = await deletePendingDocumentByIdForUser(documentId, userId);

    if (!deleted) {
      console.error('Skipped upload compensation because the document is no longer PENDING', {
        documentId,
      });
      return;
    }
  } catch (error) {
    console.error('Failed to delete document metadata after queue failure', {
      documentId,
      error,
    });
    return;
  }

  await deleteStoredFileAfterFailure(storageKey);
}

export async function uploadDocument(input: DocumentUploadInput): Promise<PublicDocument> {
  const name = validateDocumentName(input.originalName);
  validatePdfContent(input.content);

  const fileHash = calculateFileHash(input.content);

  if (await findDuplicateDocument(input.userId, fileHash)) {
    throw duplicateDocumentError();
  }

  const quotaReservation = await reserveDocumentUpload(input.userId, BigInt(input.content.length));

  if (!quotaReservation.allowed) {
    throw documentQuotaError(quotaReservation.reason);
  }

  const reservationId = quotaReservation.reservationId;
  let storageKey: string;

  try {
    storageKey = await objectStorage.uploadFile({
      userId: input.userId,
      content: input.content,
      mimeType: input.mimeType,
    });
  } catch (error) {
    await releaseDocumentQuotaReservation(reservationId, input.userId);
    throw error;
  }

  try {
    const document = await createDocumentFromUploadReservation(
      {
        userId: input.userId,
        name,
        storageKey,
        mimeType: input.mimeType,
        sizeBytes: BigInt(input.content.length),
        fileHash,
      },
      reservationId,
    );

    try {
      await enqueueDocumentProcessing({
        documentId: document.id,
        userId: input.userId,
      });
    } catch (error) {
      console.error('Failed to enqueue document processing', {
        documentId: document.id,
        error,
      });
      await compensateQueueFailure(document.id, input.userId, storageKey);
      throw new AppError(
        503,
        'PROCESSING_QUEUE_UNAVAILABLE',
        'Document processing is temporarily unavailable',
      );
    }

    return toPublicDocument(document);
  } catch (error) {
    await releaseDocumentQuotaReservation(reservationId, input.userId);
    if (error instanceof AppError && error.code === 'PROCESSING_QUEUE_UNAVAILABLE') {
      throw error;
    }

    await deleteStoredFileAfterFailure(storageKey);

    if (error instanceof DuplicateDocumentError) {
      throw duplicateDocumentError();
    }

    if (error instanceof DocumentQuotaExceededError) {
      throw documentQuotaError(error.reason);
    }

    throw error;
  }
}

export async function listDocuments(
  userId: string,
  query: DocumentListQuery,
): Promise<PublicDocumentListResult> {
  const result = await findDocumentPageByUserId({
    userId,
    page: query.page,
    limit: query.limit,
    search: query.search,
    processingStates: processingStatesForPublicStatus(query.status),
  });

  return {
    documents: result.documents.map(toPublicDocumentSummary),
    meta: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: result.total === 0 ? 0 : Math.ceil(result.total / query.limit),
      statusCounts: toPublicStatusCounts(result.statusCounts),
    },
  };
}

export async function getDocumentDetails(
  documentId: string,
  userId: string,
): Promise<PublicDocumentDetail> {
  const document = await findDocumentDetailByIdForUser(documentId, userId);

  if (!document) {
    throw documentNotFoundError();
  }

  return toPublicDocumentDetail(document);
}
