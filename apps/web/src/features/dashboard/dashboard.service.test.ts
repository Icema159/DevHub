import type { AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../lib/api-client';
import {
  getFailedDocuments,
  getRecentConversations,
  getRecentDocuments,
  mapDocumentStatus,
} from './dashboard.service';

const statusCounts = {
  all: 4,
  ready: 1,
  processing: 2,
  failed: 1,
};

function documentResponse(processingState = 'READY') {
  return {
    data: {
      documents: [
        {
          id: 'document-id',
          filename: 'Authentication Guide.pdf',
          mimeType: 'application/pdf',
          size: 1_887_436,
          processingState,
          createdAt: '2026-07-28T08:00:00.000Z',
          updatedAt: '2026-07-28T08:05:00.000Z',
          processedAt: processingState === 'READY' ? '2026-07-28T08:05:00.000Z' : null,
          storageKey: 'must-not-be-consumed',
        },
      ],
    },
    meta: {
      page: 1,
      limit: 5,
      total: 1,
      totalPages: 1,
      statusCounts,
    },
  };
}

const conversationResponse = {
  data: {
    conversations: [
      {
        id: 'conversation-id',
        title: 'JWT Authentication',
        preview: 'How does JWT authentication work?',
        createdAt: '2026-07-28T09:00:00.000Z',
        updatedAt: '2026-07-28T09:05:00.000Z',
      },
    ],
  },
  meta: {
    page: 1,
    limit: 5,
    total: 1,
    totalPages: 1,
  },
};

function responseWith(data: unknown): AxiosResponse<unknown> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: {} },
  } as AxiosResponse<unknown>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Dashboard service', () => {
  it('requests recent documents with the confirmed pagination and maps a safe DTO', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(responseWith(documentResponse()));

    const result = await getRecentDocuments();

    expect(get).toHaveBeenCalledWith('/api/documents', {
      params: { page: 1, limit: 5 },
    });
    expect(result.documents[0]).toEqual({
      id: 'document-id',
      filename: 'Authentication Guide.pdf',
      mimeType: 'application/pdf',
      size: 1_887_436,
      status: 'ready',
      createdAt: '2026-07-28T08:00:00.000Z',
      updatedAt: '2026-07-28T08:05:00.000Z',
      processedAt: '2026-07-28T08:05:00.000Z',
    });
    expect(result.documents[0]).not.toHaveProperty('storageKey');
    expect(result.documents[0]).not.toHaveProperty('processingState');
    expect(result.meta.statusCounts).toEqual(statusCounts);
  });

  it('uses the exact FAILED status filter for attention documents', async () => {
    const get = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValue(responseWith(documentResponse('FAILED')));

    await getFailedDocuments();

    expect(get).toHaveBeenCalledWith('/api/documents', {
      params: { status: 'FAILED', page: 1, limit: 3 },
    });
  });

  it('requests recent conversations with the confirmed pagination', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(responseWith(conversationResponse));

    await expect(getRecentConversations()).resolves.toEqual({
      conversations: conversationResponse.data.conversations,
      meta: conversationResponse.meta,
    });
    expect(get).toHaveBeenCalledWith('/api/conversations', {
      params: { page: 1, limit: 5 },
    });
  });

  it.each(['PENDING', 'PROCESSING', 'CHUNKS_READY', 'EMBEDDING'] as const)(
    'maps %s to the single public processing presentation',
    (state) => {
      expect(mapDocumentStatus(state)).toBe('processing');
    },
  );

  it('rejects malformed public response data safely', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      responseWith({
        data: {
          documents: [{ id: null, storageKey: 'private-key' }],
        },
      }),
    );

    await expect(getRecentDocuments()).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
      kind: 'unexpected',
      message: 'The service returned an unexpected response. Try again.',
    });
  });
});
