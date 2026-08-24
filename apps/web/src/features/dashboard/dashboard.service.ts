import { apiClient, ApiClientError } from '../../lib/api-client';
import { listConversations } from '../conversations';
import { documentListResponseSchema, type ApiDocumentState } from './dashboard.schemas';
import type {
  DashboardConversationList,
  DashboardDocument,
  DashboardDocumentList,
} from './dashboard.types';

interface DashboardRequestOptions {
  signal?: AbortSignal;
}

function invalidResponseError(): ApiClientError {
  return new ApiClientError({
    code: 'INVALID_API_RESPONSE',
    kind: 'unexpected',
    message: 'The service returned an unexpected response. Try again.',
  });
}

export function mapDocumentStatus(state: ApiDocumentState): DashboardDocument['status'] {
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

function parseDocumentList(value: unknown): DashboardDocumentList {
  const result = documentListResponseSchema.safeParse(value);

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

function requestConfig(params: Record<string, number | string>, options: DashboardRequestOptions) {
  return {
    params,
    ...(options.signal ? { signal: options.signal } : {}),
  };
}

export async function getRecentDocuments(
  options: DashboardRequestOptions = {},
): Promise<DashboardDocumentList> {
  const response = await apiClient.get<unknown>(
    '/api/documents',
    requestConfig({ page: 1, limit: 5 }, options),
  );

  return parseDocumentList(response.data);
}

export async function getFailedDocuments(
  options: DashboardRequestOptions = {},
): Promise<DashboardDocumentList> {
  const response = await apiClient.get<unknown>(
    '/api/documents',
    requestConfig({ status: 'FAILED', page: 1, limit: 3 }, options),
  );

  return parseDocumentList(response.data);
}

export async function getRecentConversations(
  options: DashboardRequestOptions = {},
): Promise<DashboardConversationList> {
  return listConversations({ page: 1, limit: 5 }, options);
}
