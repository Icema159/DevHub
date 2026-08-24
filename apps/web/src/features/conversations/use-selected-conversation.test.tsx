import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../../lib/api-client';
import * as conversationsService from './conversations.service';
import type { PublicConversationDetail } from './conversations.types';
import { useSelectedConversation } from './use-selected-conversation';

vi.mock('./conversations.service', async (importOriginal) => {
  const original = await importOriginal<typeof import('./conversations.service')>();

  return {
    ...original,
    getConversation: vi.fn(),
  };
});

const conversationA: PublicConversationDetail = {
  id: 'conversation-a',
  title: 'Conversation A',
  createdAt: '2026-07-29T08:00:00.000Z',
  updatedAt: '2026-07-29T08:01:00.000Z',
  messages: [],
};

const conversationB: PublicConversationDetail = {
  ...conversationA,
  id: 'conversation-b',
  title: null,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(conversationsService.getConversation).mockReset().mockResolvedValue(conversationA);
});

describe('useSelectedConversation', () => {
  it('loads direct-route metadata independently from the current list page', async () => {
    const { result } = renderHook(() => useSelectedConversation('conversation-a'));

    expect(result.current.resource.status).toBe('loading');
    await waitFor(() => expect(result.current.resource.status).toBe('success'));
    expect(conversationsService.getConversation).toHaveBeenCalledWith(
      'conversation-a',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('does not reuse an aborted in-flight read when the route effect restarts', async () => {
    let requestCount = 0;
    vi.mocked(conversationsService.getConversation).mockImplementation(
      (_conversationId, options) => {
        requestCount += 1;

        if (requestCount > 1) {
          return Promise.resolve(conversationA);
        }

        return new Promise((_resolve, reject) => {
          if (options?.signal?.aborted) {
            reject(new DOMException('The request was aborted.', 'AbortError'));
            return;
          }

          options?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('The request was aborted.', 'AbortError')),
            { once: true },
          );
        });
      },
    );
    const { result, rerender } = renderHook(
      ({ id }: { id: string | undefined }) => useSelectedConversation(id),
      {
        initialProps: { id: 'conversation-a' as string | undefined },
      },
    );

    rerender({ id: undefined });
    rerender({ id: 'conversation-a' });

    await waitFor(() => {
      expect(conversationsService.getConversation).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => expect(result.current.resource.status).toBe('success'));
  });

  it('uses a local unavailable state for malformed route IDs without a request', () => {
    const { result } = renderHook(() => useSelectedConversation('bad/id'));

    expect(result.current.resource.status).toBe('not-found');
    expect(conversationsService.getConversation).not.toHaveBeenCalled();
  });

  it('maps owner-hidden not-found responses to one generic state', async () => {
    vi.mocked(conversationsService.getConversation).mockRejectedValue(
      new ApiClientError({
        code: 'CONVERSATION_NOT_FOUND',
        kind: 'unexpected',
        message: 'The request could not be completed.',
        status: 404,
      }),
    );
    const { result } = renderHook(() => useSelectedConversation('foreign-conversation'));

    await waitFor(() => expect(result.current.resource.status).toBe('not-found'));
  });

  it('keeps a network failure distinct and allows explicit retry', async () => {
    vi.mocked(conversationsService.getConversation)
      .mockRejectedValueOnce(
        new ApiClientError({
          code: 'NETWORK_ERROR',
          kind: 'network',
          message: 'Unable to connect to the service.',
        }),
      )
      .mockResolvedValueOnce(conversationA);
    const { result } = renderHook(() => useSelectedConversation('conversation-a'));
    await waitFor(() => expect(result.current.resource.status).toBe('error'));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.resource.status).toBe('success');
    expect(conversationsService.getConversation).toHaveBeenCalledTimes(2);
  });

  it('prevents conversation A from overwriting a rapidly selected conversation B', async () => {
    const requestA = deferred<PublicConversationDetail>();
    const requestB = deferred<PublicConversationDetail>();
    vi.mocked(conversationsService.getConversation)
      .mockReturnValueOnce(requestA.promise)
      .mockReturnValueOnce(requestB.promise);
    const { result, rerender } = renderHook(({ id }) => useSelectedConversation(id), {
      initialProps: { id: 'conversation-a' },
    });

    rerender({ id: 'conversation-b' });
    await act(async () => {
      requestB.resolve(conversationB);
      await requestB.promise;
      requestA.resolve(conversationA);
      await requestA.promise;
    });

    expect(result.current.resource.status).toBe('success');
    if (result.current.resource.status === 'success') {
      expect(result.current.resource.data.id).toBe('conversation-b');
      expect(result.current.resource.data.title).toBeNull();
    }
  });

  it('aborts the selected read on unmount', () => {
    const request = deferred<PublicConversationDetail>();
    vi.mocked(conversationsService.getConversation).mockReturnValue(request.promise);
    const { unmount } = renderHook(() => useSelectedConversation('conversation-a'));
    const signal = vi.mocked(conversationsService.getConversation).mock.calls[0]?.[1]?.signal;

    unmount();

    expect(signal?.aborted).toBe(true);
  });

  it('forces an authoritative refresh so an older detail read cannot remove a completed turn', async () => {
    const initialRequest = deferred<PublicConversationDetail>();
    const refreshedRequest = deferred<PublicConversationDetail>();
    const completedConversation: PublicConversationDetail = {
      ...conversationA,
      updatedAt: '2026-07-29T08:03:00.000Z',
      messages: [
        {
          id: 'server-user-id',
          role: 'USER',
          content: 'Question',
          createdAt: '2026-07-29T08:02:00.000Z',
          sources: [],
        },
        {
          id: 'server-assistant-id',
          role: 'ASSISTANT',
          content: 'Answer',
          createdAt: '2026-07-29T08:03:00.000Z',
          sources: [],
        },
      ],
    };
    vi.mocked(conversationsService.getConversation)
      .mockReturnValueOnce(initialRequest.promise)
      .mockReturnValueOnce(refreshedRequest.promise);
    const { result } = renderHook(() => useSelectedConversation('conversation-a'));

    let authoritativeRefresh!: Promise<unknown>;
    act(() => {
      authoritativeRefresh = result.current.refreshAuthoritative();
    });

    await act(async () => {
      refreshedRequest.resolve(completedConversation);
      await authoritativeRefresh;
      initialRequest.resolve(conversationA);
      await initialRequest.promise;
    });

    expect(result.current.resource.status).toBe('success');
    if (result.current.resource.status === 'success') {
      expect(result.current.resource.data.messages).toHaveLength(2);
      expect(result.current.resource.data.messages[1]?.id).toBe('server-assistant-id');
    }
  });
});
