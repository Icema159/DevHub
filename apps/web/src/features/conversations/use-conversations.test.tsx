import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../../lib/api-client';
import * as conversationsService from './conversations.service';
import type { ConversationListResult } from './conversations.types';
import { useConversations } from './use-conversations';

vi.mock('./conversations.service', async (importOriginal) => {
  const original = await importOriginal<typeof import('./conversations.service')>();

  return {
    ...original,
    listConversations: vi.fn(),
  };
});

const pageOne: ConversationListResult = {
  conversations: [
    {
      id: 'conversation-b',
      title: 'Second by backend order',
      preview: 'Question B',
      createdAt: '2026-07-29T08:00:00.000Z',
      updatedAt: '2026-07-29T10:00:00.000Z',
    },
    {
      id: 'conversation-a',
      title: null,
      preview: null,
      createdAt: '2026-07-29T07:00:00.000Z',
      updatedAt: '2026-07-29T09:00:00.000Z',
    },
  ],
  meta: { page: 1, limit: 20, total: 22, totalPages: 2 },
};

const pageTwo: ConversationListResult = {
  conversations: [
    {
      id: 'conversation-c',
      title: 'Page two',
      preview: 'Question C',
      createdAt: '2026-07-28T08:00:00.000Z',
      updatedAt: '2026-07-28T10:00:00.000Z',
    },
  ],
  meta: { page: 2, limit: 20, total: 22, totalPages: 2 },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(conversationsService.listConversations).mockResolvedValue(pageOne);
});

describe('useConversations', () => {
  it('loads the requested page with an AbortSignal and preserves backend order and metadata', async () => {
    const { result } = renderHook(() => useConversations({ page: 1 }));

    expect(result.current.resource.status).toBe('loading');
    await waitFor(() => expect(result.current.resource.status).toBe('success'));

    expect(conversationsService.listConversations).toHaveBeenCalledWith(
      { page: 1, limit: 20 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    if (result.current.resource.status === 'success') {
      expect(result.current.resource.data.conversations.map(({ id }) => id)).toEqual([
        'conversation-b',
        'conversation-a',
      ]);
      expect(result.current.resource.data.meta).toEqual(pageOne.meta);
    }
  });

  it('loads page changes and prevents an older response from replacing the newer page', async () => {
    const first = deferred<ConversationListResult>();
    const second = deferred<ConversationListResult>();
    vi.mocked(conversationsService.listConversations)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(({ page }) => useConversations({ page }), {
      initialProps: { page: 1 },
    });

    rerender({ page: 2 });
    await act(async () => {
      second.resolve(pageTwo);
      await second.promise;
    });
    expect(result.current.resource.status).toBe('success');

    await act(async () => {
      first.resolve(pageOne);
      await first.promise;
    });

    if (result.current.resource.status === 'success') {
      expect(result.current.resource.data.meta.page).toBe(2);
      expect(result.current.resource.data.conversations[0]?.id).toBe('conversation-c');
    }
  });

  it('shows a safe list error and performs one explicit retry', async () => {
    vi.mocked(conversationsService.listConversations)
      .mockRejectedValueOnce(
        new ApiClientError({
          code: 'NETWORK_ERROR',
          kind: 'network',
          message: 'Unable to connect to the service.',
        }),
      )
      .mockResolvedValueOnce(pageOne);
    const { result } = renderHook(() => useConversations({ page: 1 }));
    await waitFor(() => expect(result.current.resource.status).toBe('error'));

    await act(async () => {
      await result.current.refresh();
    });

    expect(conversationsService.listConversations).toHaveBeenCalledTimes(2);
    expect(result.current.resource.status).toBe('success');
  });

  it('preserves visible data and scopes a refresh error', async () => {
    vi.mocked(conversationsService.listConversations)
      .mockResolvedValueOnce(pageOne)
      .mockRejectedValueOnce(
        new ApiClientError({
          code: 'NETWORK_ERROR',
          kind: 'network',
          message: 'Unable to connect to the service.',
        }),
      );
    const { result } = renderHook(() => useConversations({ page: 1 }));
    await waitFor(() => expect(result.current.resource.status).toBe('success'));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.resource.status).toBe('success');
    if (result.current.resource.status === 'success') {
      expect(result.current.resource.data).toEqual(pageOne);
      expect(result.current.resource.refreshError?.code).toBe('NETWORK_ERROR');
      expect(result.current.resource.isRefreshing).toBe(false);
    }
  });

  it('prevents duplicate simultaneous manual refreshes', async () => {
    const refresh = deferred<ConversationListResult>();
    vi.mocked(conversationsService.listConversations)
      .mockResolvedValueOnce(pageOne)
      .mockReturnValueOnce(refresh.promise);
    const { result } = renderHook(() => useConversations({ page: 1 }));
    await waitFor(() => expect(result.current.resource.status).toBe('success'));

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.refresh();
      second = result.current.refresh();
    });

    expect(first).toBe(second);
    expect(conversationsService.listConversations).toHaveBeenCalledTimes(2);

    await act(async () => {
      refresh.resolve(pageOne);
      await first;
    });
  });

  it('forces a post-create revision refresh over a pre-create stale request', async () => {
    const stale = deferred<ConversationListResult>();
    const refreshed = deferred<ConversationListResult>();
    vi.mocked(conversationsService.listConversations)
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(refreshed.promise);
    const { result, rerender } = renderHook(
      ({ revision }) => useConversations({ page: 1, revision }),
      { initialProps: { revision: 0 } },
    );

    rerender({ revision: 1 });
    await act(async () => {
      refreshed.resolve(pageOne);
      await refreshed.promise;
      stale.resolve({
        conversations: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
      await stale.promise;
    });

    if (result.current.resource.status === 'success') {
      expect(result.current.resource.data.conversations).toHaveLength(2);
    }
  });

  it('requests one controlled fallback when the page is out of range', async () => {
    const onPageOutOfRange = vi.fn();
    vi.mocked(conversationsService.listConversations).mockResolvedValue({
      conversations: [],
      meta: { page: 4, limit: 20, total: 22, totalPages: 2 },
    });
    renderHook(() => useConversations({ page: 4, onPageOutOfRange }));

    await waitFor(() => expect(onPageOutOfRange).toHaveBeenCalledWith(2));
    expect(onPageOutOfRange).toHaveBeenCalledOnce();
  });

  it('aborts a pending read on unmount without producing a user-facing error', () => {
    const pending = deferred<ConversationListResult>();
    vi.mocked(conversationsService.listConversations).mockReturnValue(pending.promise);
    const { unmount } = renderHook(() => useConversations({ page: 1 }));
    const signal = vi.mocked(conversationsService.listConversations).mock.calls[0]?.[1]?.signal;

    unmount();

    expect(signal?.aborted).toBe(true);
  });
});
