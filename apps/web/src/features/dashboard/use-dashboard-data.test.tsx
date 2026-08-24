import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../../lib/api-client';
import * as dashboardService from './dashboard.service';
import type { DashboardConversationList, DashboardDocumentList } from './dashboard.types';
import { useDashboardData } from './use-dashboard-data';

vi.mock('./dashboard.service', () => ({
  getFailedDocuments: vi.fn(),
  getRecentConversations: vi.fn(),
  getRecentDocuments: vi.fn(),
}));

const documents: DashboardDocumentList = {
  documents: [],
  meta: {
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 0,
    statusCounts: { all: 0, ready: 0, processing: 0, failed: 0 },
  },
};

const failedDocuments: DashboardDocumentList = {
  ...documents,
  meta: { ...documents.meta, limit: 3 },
};

const conversations: DashboardConversationList = {
  conversations: [],
  meta: { page: 1, limit: 5, total: 0, totalPages: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(dashboardService.getRecentDocuments).mockResolvedValue(documents);
  vi.mocked(dashboardService.getFailedDocuments).mockResolvedValue(failedDocuments);
  vi.mocked(dashboardService.getRecentConversations).mockResolvedValue(conversations);
});

describe('useDashboardData', () => {
  it('starts all three independent resources once on mount', async () => {
    const { result } = renderHook(() => useDashboardData());

    expect(result.current.documents.status).toBe('loading');
    expect(result.current.conversations.status).toBe('loading');
    expect(result.current.failedDocuments.status).toBe('loading');

    await waitFor(() => {
      expect(result.current.documents.status).toBe('success');
      expect(result.current.conversations.status).toBe('success');
      expect(result.current.failedDocuments.status).toBe('success');
    });

    expect(dashboardService.getRecentDocuments).toHaveBeenCalledOnce();
    expect(dashboardService.getRecentConversations).toHaveBeenCalledOnce();
    expect(dashboardService.getFailedDocuments).toHaveBeenCalledOnce();
  });

  it('keeps a document failure scoped while conversations still succeed', async () => {
    vi.mocked(dashboardService.getRecentDocuments).mockRejectedValue(
      new ApiClientError({
        code: 'NETWORK_ERROR',
        kind: 'network',
        message: 'Unable to connect.',
      }),
    );

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.documents.status).toBe('error');
      expect(result.current.conversations.status).toBe('success');
      expect(result.current.failedDocuments.status).toBe('success');
    });
  });

  it('retries only the requested resource', async () => {
    vi.mocked(dashboardService.getRecentDocuments).mockRejectedValueOnce(
      new ApiClientError({
        code: 'HTTP_500',
        kind: 'server',
        message: 'The service is temporarily unavailable.',
        status: 500,
      }),
    );

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(result.current.documents.status).toBe('error');
    });

    vi.mocked(dashboardService.getRecentDocuments).mockResolvedValue(documents);

    await act(async () => {
      await result.current.retryDocuments();
    });

    expect(result.current.documents.status).toBe('success');
    expect(dashboardService.getRecentDocuments).toHaveBeenCalledTimes(2);
    expect(dashboardService.getRecentConversations).toHaveBeenCalledOnce();
    expect(dashboardService.getFailedDocuments).toHaveBeenCalledOnce();
  });
});
