import { apiClient, ApiClientError, normalizeApiError } from '../../lib/api-client';
import {
  documentDeletionResponseSchema,
  documentDetailsResponseSchema,
  documentListResponseSchema,
  documentRetryResponseSchema,
  documentUploadResponseSchema,
} from './documents.schemas';
import type {
  DocumentApiState,
  DocumentList,
  DocumentListQuery,
  PublicDeletedDocument,
  PublicDocument,
  PublicDocumentDetails,
} from './documents.types';

interface RequestOptions {
  signal?: AbortSignal;
}

function invalidResponseError(): ApiClientError {
  return new ApiClientError({
    code: 'INVALID_API_RESPONSE',
    kind: 'unexpected',
    message: 'The service returned an unexpected response. Try again.',
  });
}

export function mapDocumentStatus(state: DocumentApiState): PublicDocument['status'] {
  switch (state) {
    case 'READY':
      return 'ready';
    case 'FAILED':
      return 'failed';
    case 'PENDING':
    case 'PROCESSING':
    case 'CHUNKS_READY':
    case 'EMBEDDING':
      return 'processing';
  }
}

function requestOptions(options: RequestOptions) {
  return options.signal ? { signal: options.signal } : {};
}

const DOCUMENT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MAX_DOCUMENT_ID_LENGTH = 128;

export function isValidDocumentId(documentId: string): boolean {
  return (
    documentId.length > 0 &&
    documentId.length <= MAX_DOCUMENT_ID_LENGTH &&
    DOCUMENT_ID_PATTERN.test(documentId)
  );
}

export async function getDocuments(
  query: DocumentListQuery,
  options: RequestOptions = {},
): Promise<DocumentList> {
  const trimmedSearch = query.search?.trim();
  const response = await apiClient.get<unknown>('/api/documents', {
    ...requestOptions(options),
    params: {
      page: query.page,
      limit: query.limit,
      ...(trimmedSearch ? { search: trimmedSearch } : {}),
      ...(query.status === 'ALL' ? {} : { status: query.status }),
    },
  });
  const result = documentListResponseSchema.safeParse(response.data);

  if (!result.success) {
    throw invalidResponseError();
  }

  return {
    documents: result.data.data.documents.map((document) => ({
      id: document.id,
      filename: document.filename,
      mimeType: document.mimeType,
      size: document.size,
      status: mapDocumentStatus(document.processingState),
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      processedAt: document.processedAt,
    })),
    meta: result.data.meta,
  };
}

export async function getDocumentById(
  documentId: string,
  options: RequestOptions = {},
): Promise<PublicDocumentDetails> {
  const response = await apiClient.get<unknown>(
    `/api/documents/${encodeURIComponent(documentId)}`,
    requestOptions(options),
  );
  const result = documentDetailsResponseSchema.safeParse(response.data);

  if (!result.success) {
    throw invalidResponseError();
  }

  return mapPublicDocumentDetails(result.data.data.document);
}

function mapPublicDocumentDetails(
  document: (typeof documentDetailsResponseSchema)['_output']['data']['document'],
): PublicDocumentDetails {
  return {
    id: document.id,
    filename: document.filename,
    mimeType: document.mimeType,
    size: document.size,
    status: mapDocumentStatus(document.processingState),
    processingError: document.processingError,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    processedAt: document.processedAt,
  };
}

function safeRetryError(error: unknown): ApiClientError {
  const normalizedError = normalizeApiError(error);

  if (normalizedError.code === 'PROCESSING_QUEUE_UNAVAILABLE') {
    return new ApiClientError({
      code: normalizedError.code,
      kind: 'server',
      message: 'Processing could not be restarted right now. Try again.',
      status: normalizedError.status,
    });
  }

  if (normalizedError.code === 'INVALID_DOCUMENT_STATE') {
    return new ApiClientError({
      code: normalizedError.code,
      kind: 'conflict',
      message: 'The document status changed. Refresh to view its latest state.',
      status: normalizedError.status,
    });
  }

  if (normalizedError.code === 'PROCESSING_LIMIT_REACHED') {
    return new ApiClientError({
      code: normalizedError.code,
      kind: 'conflict',
      message: 'You already have two documents being processed.',
      status: normalizedError.status,
    });
  }

  return normalizedError;
}

export async function retryDocumentProcessing(
  documentId: string,
  options: RequestOptions = {},
): Promise<PublicDocumentDetails> {
  try {
    const response = await apiClient.post<unknown>(
      `/api/documents/${encodeURIComponent(documentId)}/retry`,
      undefined,
      requestOptions(options),
    );
    const result = documentRetryResponseSchema.safeParse(response.data);

    if (!result.success) {
      throw invalidResponseError();
    }

    return mapPublicDocumentDetails(result.data.data.document);
  } catch (error) {
    throw safeRetryError(error);
  }
}

function safeDeletionError(error: unknown): ApiClientError {
  const normalizedError = normalizeApiError(error);

  if (normalizedError.code === 'DOCUMENT_DELETION_QUEUE_UNAVAILABLE') {
    return new ApiClientError({
      code: normalizedError.code,
      kind: 'server',
      message: 'The document could not be deleted right now. Try again.',
      status: normalizedError.status,
    });
  }

  return normalizedError;
}

export async function deleteDocument(
  documentId: string,
  options: RequestOptions = {},
): Promise<PublicDeletedDocument> {
  try {
    const response = await apiClient.delete<unknown>(
      `/api/documents/${encodeURIComponent(documentId)}`,
      requestOptions(options),
    );
    const result = documentDeletionResponseSchema.safeParse(response.data);

    if (!result.success) {
      throw invalidResponseError();
    }

    return result.data.data.document;
  } catch (error) {
    throw safeDeletionError(error);
  }
}

function safeUploadError(error: unknown): ApiClientError {
  const normalizedError = normalizeApiError(error);

  switch (normalizedError.code) {
    case 'DUPLICATE_DOCUMENT':
      return new ApiClientError({
        code: normalizedError.code,
        kind: 'conflict',
        message: 'This document already exists in your knowledge base.',
        status: normalizedError.status,
      });
    case 'UNSUPPORTED_FILE_TYPE':
    case 'INVALID_PDF':
      return new ApiClientError({
        code: normalizedError.code,
        kind: 'validation',
        message: 'Only valid PDF files are supported.',
        status: normalizedError.status,
      });
    case 'FILE_TOO_LARGE':
      return new ApiClientError({
        code: normalizedError.code,
        kind: 'validation',
        message: 'This file is too large. The maximum size is 10 MB.',
        status: normalizedError.status,
      });
    case 'DOCUMENT_LIMIT_REACHED':
      return new ApiClientError({
        code: normalizedError.code,
        kind: 'conflict',
        message: "You've reached the document limit for this demo.",
        status: normalizedError.status,
      });
    case 'STORAGE_LIMIT_REACHED':
      return new ApiClientError({
        code: normalizedError.code,
        kind: 'conflict',
        message: "You've reached the storage limit for this demo.",
        status: normalizedError.status,
      });
    case 'PROCESSING_LIMIT_REACHED':
      return new ApiClientError({
        code: normalizedError.code,
        kind: 'conflict',
        message: 'You already have two documents being processed.',
        status: normalizedError.status,
      });
    case 'FILE_REQUIRED':
    case 'INVALID_FILE_NAME':
    case 'INVALID_MULTIPART_UPLOAD':
      return new ApiClientError({
        code: normalizedError.code,
        kind: 'validation',
        message: 'Check the selected PDF and try again.',
        status: normalizedError.status,
      });
    default:
      return normalizedError;
  }
}

export async function uploadDocument(
  file: File,
  options: RequestOptions = {},
): Promise<PublicDocument> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await apiClient.post<unknown>(
      '/api/documents',
      formData,
      requestOptions(options),
    );
    const result = documentUploadResponseSchema.safeParse(response.data);

    if (!result.success) {
      throw invalidResponseError();
    }

    const document = result.data.document;

    return {
      id: document.id,
      filename: document.name,
      mimeType: document.mimeType,
      size: document.sizeBytes,
      status: mapDocumentStatus(document.status),
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      processedAt: document.processedAt,
    };
  } catch (error) {
    throw safeUploadError(error);
  }
}
