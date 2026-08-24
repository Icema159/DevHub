import type { AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient, ApiClientError } from '../../lib/api-client';
import {
  deleteDocument,
  getDocumentById,
  getDocuments,
  isValidDocumentId,
  mapDocumentStatus,
  retryDocumentProcessing,
  uploadDocument,
} from './documents.service';

const listResponse = {
  data: {
    documents: [
      {
        id: 'document-id',
        filename: 'Authentication Guide.pdf',
        mimeType: 'application/pdf',
        size: 1_887_436,
        processingState: 'READY',
        createdAt: '2026-07-29T08:00:00.000Z',
        updatedAt: '2026-07-29T08:05:00.000Z',
        processedAt: '2026-07-29T08:05:00.000Z',
        storageKey: 'private-storage-key',
        fileHash: 'private-file-hash',
      },
    ],
  },
  meta: {
    page: 2,
    limit: 20,
    total: 21,
    totalPages: 2,
    statusCounts: { all: 21, ready: 18, processing: 2, failed: 1 },
  },
};

const uploadResponse = {
  document: {
    id: 'uploaded-document',
    name: 'New Guide.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1_024,
    status: 'PENDING',
    createdAt: '2026-07-29T09:00:00.000Z',
    updatedAt: '2026-07-29T09:00:00.000Z',
    processedAt: null,
    storageKey: 'private-storage-key',
  },
};

const detailsResponse = {
  data: {
    document: {
      id: 'document-id',
      filename: 'Authentication Guide.pdf',
      mimeType: 'application/pdf',
      size: 1_887_436,
      processingState: 'FAILED',
      processingError: 'Document embedding generation failed',
      createdAt: '2026-07-29T08:00:00.000Z',
      updatedAt: '2026-07-29T08:05:00.000Z',
      processedAt: null,
      userId: 'private-owner-id',
      storageKey: 'private-storage-key',
      fileHash: 'private-file-hash',
      chunks: [{ content: 'private chunk' }],
    },
  },
};

const deletionResponse = {
  data: {
    document: {
      id: 'document-id',
      deletedAt: '2026-07-29T09:30:00.000Z',
      queueJobId: 'private-job-id',
      storageKey: 'private-storage-key',
    },
  },
};

const retryResponse = {
  data: {
    document: {
      id: 'document-id',
      filename: 'Authentication Guide.pdf',
      mimeType: 'application/pdf',
      size: 1_887_436,
      processingState: 'PROCESSING',
      processingError: null,
      createdAt: '2026-07-29T08:00:00.000Z',
      updatedAt: '2026-07-29T09:45:00.000Z',
      processedAt: null,
      userId: 'private-owner-id',
      storageKey: 'private-storage-key',
      queueJobId: 'private-job-id',
    },
  },
};

function responseWith(data: unknown, status = 200): AxiosResponse<unknown> {
  return {
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: { headers: {} },
  } as AxiosResponse<unknown>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Documents service', () => {
  it('requests the confirmed endpoint with page, limit, trimmed search, and public status', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(responseWith(listResponse));

    await getDocuments({
      page: 2,
      limit: 20,
      search: '  Authentication  ',
      status: 'PROCESSING',
    });

    expect(get).toHaveBeenCalledWith('/api/documents', {
      params: {
        page: 2,
        limit: 20,
        search: 'Authentication',
        status: 'PROCESSING',
      },
    });
  });

  it('omits empty search and the default ALL status', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(responseWith(listResponse));

    await getDocuments({ page: 1, limit: 20, search: '   ', status: 'ALL' });

    expect(get).toHaveBeenCalledWith('/api/documents', {
      params: { page: 1, limit: 20 },
    });
  });

  it('maps only explicit public fields from the list response', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(responseWith(listResponse));

    const result = await getDocuments({ page: 2, limit: 20, status: 'ALL' });

    expect(result.documents[0]).toEqual({
      id: 'document-id',
      filename: 'Authentication Guide.pdf',
      mimeType: 'application/pdf',
      size: 1_887_436,
      status: 'ready',
      createdAt: '2026-07-29T08:00:00.000Z',
      updatedAt: '2026-07-29T08:05:00.000Z',
      processedAt: '2026-07-29T08:05:00.000Z',
    });
    expect(result.documents[0]).not.toHaveProperty('storageKey');
    expect(result.documents[0]).not.toHaveProperty('fileHash');
  });

  it.each(['PENDING', 'PROCESSING', 'CHUNKS_READY', 'EMBEDDING'] as const)(
    'maps %s to the grouped processing presentation',
    (state) => {
      expect(mapDocumentStatus(state)).toBe('processing');
    },
  );

  it('maps READY and FAILED to their public presentations', () => {
    expect(mapDocumentStatus('READY')).toBe('ready');
    expect(mapDocumentStatus('FAILED')).toBe('failed');
  });

  it('requests document details through the encoded confirmed endpoint and passes the signal', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(responseWith(detailsResponse));
    const controller = new AbortController();

    await getDocumentById('document/id?owner=other', { signal: controller.signal });

    expect(get).toHaveBeenCalledWith('/api/documents/document%2Fid%3Fowner%3Dother', {
      signal: controller.signal,
    });
  });

  it('maps only the explicit safe public document-details fields', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(responseWith(detailsResponse));

    const document = await getDocumentById('document-id');

    expect(document).toEqual({
      id: 'document-id',
      filename: 'Authentication Guide.pdf',
      mimeType: 'application/pdf',
      size: 1_887_436,
      status: 'failed',
      processingError: 'Document embedding generation failed',
      createdAt: '2026-07-29T08:00:00.000Z',
      updatedAt: '2026-07-29T08:05:00.000Z',
      processedAt: null,
    });
    expect(document).not.toHaveProperty('userId');
    expect(document).not.toHaveProperty('storageKey');
    expect(document).not.toHaveProperty('fileHash');
    expect(document).not.toHaveProperty('chunks');
  });

  it('rejects a malformed document-details response safely', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      responseWith({ data: { document: { id: 'document-id', processingError: null } } }),
    );

    await expect(getDocumentById('document-id')).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
      message: 'The service returned an unexpected response. Try again.',
    });
  });

  it('preserves normalized API errors from the shared client', async () => {
    const error = new ApiClientError({
      code: 'DOCUMENT_NOT_FOUND',
      kind: 'unexpected',
      message: 'The request could not be completed.',
      status: 404,
    });
    vi.spyOn(apiClient, 'get').mockRejectedValue(error);

    await expect(getDocumentById('missing-document')).rejects.toBe(error);
  });

  it('validates document IDs using the backend route-parameter rules', () => {
    expect(isValidDocumentId('cm123_document-id')).toBe(true);
    expect(isValidDocumentId('')).toBe(false);
    expect(isValidDocumentId('document/id')).toBe(false);
    expect(isValidDocumentId('x'.repeat(129))).toBe(false);
  });

  it('deletes through the encoded confirmed endpoint, passes the signal, and parses the 202 DTO', async () => {
    const remove = vi
      .spyOn(apiClient, 'delete')
      .mockResolvedValue(responseWith(deletionResponse, 202));
    const controller = new AbortController();

    const document = await deleteDocument('document/id?owner=other', {
      signal: controller.signal,
    });

    expect(remove).toHaveBeenCalledWith('/api/documents/document%2Fid%3Fowner%3Dother', {
      signal: controller.signal,
    });
    expect(document).toEqual({
      id: 'document-id',
      deletedAt: '2026-07-29T09:30:00.000Z',
    });
    expect(document).not.toHaveProperty('queueJobId');
    expect(document).not.toHaveProperty('storageKey');
  });

  it('rejects a malformed deletion response without exposing it', async () => {
    vi.spyOn(apiClient, 'delete').mockResolvedValue(
      responseWith({ data: { document: { id: 'document-id', deletedAt: null } } }, 202),
    );

    await expect(deleteDocument('document-id')).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
      message: 'The service returned an unexpected response. Try again.',
    });
  });

  it('maps cleanup queue submission failure to safe deletion feedback', async () => {
    vi.spyOn(apiClient, 'delete').mockRejectedValue(
      new ApiClientError({
        code: 'DOCUMENT_DELETION_QUEUE_UNAVAILABLE',
        kind: 'server',
        message: 'The service is temporarily unavailable. Try again later.',
        status: 503,
      }),
    );

    await expect(deleteDocument('document-id')).rejects.toMatchObject({
      code: 'DOCUMENT_DELETION_QUEUE_UNAVAILABLE',
      message: 'The document could not be deleted right now. Try again.',
    });
  });

  it('preserves the normalized owner-hidden not-found deletion error', async () => {
    const error = new ApiClientError({
      code: 'DOCUMENT_NOT_FOUND',
      kind: 'unexpected',
      message: 'The request could not be completed.',
      status: 404,
    });
    vi.spyOn(apiClient, 'delete').mockRejectedValue(error);

    await expect(deleteDocument('missing-document')).rejects.toBe(error);
  });

  it('retries through the encoded POST endpoint, passes the signal, and parses the 202 DTO', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(responseWith(retryResponse, 202));
    const controller = new AbortController();

    const document = await retryDocumentProcessing('document/id?owner=other', {
      signal: controller.signal,
    });

    expect(post).toHaveBeenCalledWith(
      '/api/documents/document%2Fid%3Fowner%3Dother/retry',
      undefined,
      { signal: controller.signal },
    );
    expect(document).toEqual({
      id: 'document-id',
      filename: 'Authentication Guide.pdf',
      mimeType: 'application/pdf',
      size: 1_887_436,
      status: 'processing',
      processingError: null,
      createdAt: '2026-07-29T08:00:00.000Z',
      updatedAt: '2026-07-29T09:45:00.000Z',
      processedAt: null,
    });
    expect(document).not.toHaveProperty('userId');
    expect(document).not.toHaveProperty('storageKey');
    expect(document).not.toHaveProperty('queueJobId');
  });

  it('rejects a malformed Retry response safely', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue(
      responseWith(
        {
          data: {
            document: {
              id: 'document-id',
              processingState: 'PROCESSING',
              processingError: null,
            },
          },
        },
        202,
      ),
    );

    await expect(retryDocumentProcessing('document-id')).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
      message: 'The service returned an unexpected response. Try again.',
    });
  });

  it('maps Retry queue failure to safe retryable feedback', async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValue(
      new ApiClientError({
        code: 'PROCESSING_QUEUE_UNAVAILABLE',
        kind: 'server',
        message: 'Document processing is temporarily unavailable.',
        status: 503,
      }),
    );

    await expect(retryDocumentProcessing('document-id')).rejects.toMatchObject({
      code: 'PROCESSING_QUEUE_UNAVAILABLE',
      message: 'Processing could not be restarted right now. Try again.',
    });
  });

  it('maps an invalid Retry state to a safe stale-state category', async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValue(
      new ApiClientError({
        code: 'INVALID_DOCUMENT_STATE',
        kind: 'conflict',
        message: 'Only failed documents can be retried.',
        status: 409,
      }),
    );

    await expect(retryDocumentProcessing('document-id')).rejects.toMatchObject({
      code: 'INVALID_DOCUMENT_STATE',
      kind: 'conflict',
      message: 'The document status changed. Refresh to view its latest state.',
    });
  });

  it('preserves the owner-hidden not-found Retry error', async () => {
    const error = new ApiClientError({
      code: 'DOCUMENT_NOT_FOUND',
      kind: 'unexpected',
      message: 'The request could not be completed.',
      status: 404,
    });
    vi.spyOn(apiClient, 'post').mockRejectedValue(error);

    await expect(retryDocumentProcessing('missing-document')).rejects.toBe(error);
  });

  it('uploads through the confirmed endpoint and multipart file field', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(responseWith(uploadResponse, 201));
    const file = new File(['%PDF-test'], 'New Guide.pdf', { type: 'application/pdf' });

    const document = await uploadDocument(file);

    expect(post).toHaveBeenCalledOnce();
    expect(post.mock.calls[0]?.[0]).toBe('/api/documents');
    expect(post.mock.calls[0]?.[1]).toBeInstanceOf(FormData);
    expect((post.mock.calls[0]?.[1] as FormData).get('file')).toBe(file);
    expect(post.mock.calls[0]?.[2]).toEqual({});
    expect(document).toMatchObject({
      filename: 'New Guide.pdf',
      size: 1_024,
      status: 'processing',
    });
    expect(document).not.toHaveProperty('storageKey');
  });

  it('maps a duplicate response to the approved friendly message', async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValue(
      new ApiClientError({
        code: 'DUPLICATE_DOCUMENT',
        kind: 'conflict',
        message: 'The request conflicts with existing information.',
        status: 409,
      }),
    );

    await expect(
      uploadDocument(new File(['%PDF-test'], 'Guide.pdf', { type: 'application/pdf' })),
    ).rejects.toMatchObject({
      code: 'DUPLICATE_DOCUMENT',
      message: 'This document already exists in your knowledge base.',
    });
  });

  it('maps upload and Retry quota denials to concise existing UI feedback', async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(
      new ApiClientError({
        code: 'DOCUMENT_LIMIT_REACHED',
        kind: 'conflict',
        message: 'Request denied.',
        status: 409,
      }),
    );

    await expect(
      uploadDocument(new File(['%PDF-test'], 'Guide.pdf', { type: 'application/pdf' })),
    ).rejects.toMatchObject({
      code: 'DOCUMENT_LIMIT_REACHED',
      message: "You've reached the document limit for this demo.",
    });

    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(
      new ApiClientError({
        code: 'PROCESSING_LIMIT_REACHED',
        kind: 'conflict',
        message: 'Request denied.',
        status: 409,
      }),
    );
    await expect(retryDocumentProcessing('document-a')).rejects.toMatchObject({
      code: 'PROCESSING_LIMIT_REACHED',
      message: 'You already have two documents being processed.',
    });
  });

  it('rejects malformed API responses safely', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      responseWith({ data: { documents: [{ id: null, storageKey: 'secret' }] } }),
    );

    await expect(getDocuments({ page: 1, limit: 20, status: 'ALL' })).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
      message: 'The service returned an unexpected response. Try again.',
    });
  });
});
