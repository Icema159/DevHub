import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../../lib/api-client';
import * as conversationsService from './conversations.service';
import type { PublicConversation } from './conversations.types';
import { useCreateConversation } from './use-create-conversation';

vi.mock('./conversations.service', async (importOriginal) => {
  const original = await importOriginal<typeof import('./conversations.service')>();

  return {
    ...original,
    createConversation: vi.fn(),
  };
});

const createdConversation: PublicConversation = {
  id: 'server-conversation-id',
  title: null,
  createdAt: '2026-07-29T08:00:00.000Z',
  updatedAt: '2026-07-29T08:00:00.000Z',
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
  vi.mocked(conversationsService.createConversation).mockResolvedValue(createdConversation);
});

describe('useCreateConversation', () => {
  it('does not create on initialization and preserves the server-confirmed ID on success', async () => {
    const onCreated = vi.fn();
    const { result } = renderHook(() => useCreateConversation({ onCreated }));

    expect(conversationsService.createConversation).not.toHaveBeenCalled();

    let created!: PublicConversation;
    await act(async () => {
      created = await result.current.create();
    });

    expect(created).toBe(createdConversation);
    expect(created.id).toBe('server-conversation-id');
    expect(onCreated).toHaveBeenCalledWith(createdConversation);
    expect(result.current.resource.status).toBe('success');
  });

  it('exposes creating state and turns duplicate activation into one request', async () => {
    const request = deferred<PublicConversation>();
    vi.mocked(conversationsService.createConversation).mockReturnValue(request.promise);
    const { result } = renderHook(() => useCreateConversation({ onCreated: vi.fn() }));

    let first!: Promise<PublicConversation>;
    let second!: Promise<PublicConversation>;
    act(() => {
      first = result.current.create();
      second = result.current.create();
    });

    expect(first).toBe(second);
    expect(result.current.isCreating).toBe(true);
    expect(conversationsService.createConversation).toHaveBeenCalledOnce();

    await act(async () => {
      request.resolve(createdConversation);
      await first;
    });
  });

  it('preserves a safe failure and allows one later explicit attempt without automatic retry', async () => {
    vi.mocked(conversationsService.createConversation)
      .mockRejectedValueOnce(
        new ApiClientError({
          code: 'NETWORK_ERROR',
          kind: 'network',
          message: 'Unable to connect to the service.',
        }),
      )
      .mockResolvedValueOnce(createdConversation);
    const onCreated = vi.fn();
    const { result } = renderHook(() => useCreateConversation({ onCreated }));

    await act(async () => {
      await expect(result.current.create()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    });
    expect(result.current.resource.status).toBe('error');
    expect(conversationsService.createConversation).toHaveBeenCalledOnce();

    await act(async () => {
      await result.current.create();
    });
    expect(conversationsService.createConversation).toHaveBeenCalledTimes(2);
    expect(onCreated).toHaveBeenCalledOnce();
  });

  it('does not abort or update local state after unmount while an accepted create remains pending', async () => {
    const request = deferred<PublicConversation>();
    const onCreated = vi.fn();
    vi.mocked(conversationsService.createConversation).mockReturnValue(request.promise);
    const { result, unmount } = renderHook(() => useCreateConversation({ onCreated }));
    let createRequest!: Promise<PublicConversation>;

    act(() => {
      createRequest = result.current.create();
    });
    unmount();

    await act(async () => {
      request.resolve(createdConversation);
      await createRequest;
    });

    expect(conversationsService.createConversation).toHaveBeenCalledOnce();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
