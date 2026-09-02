import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../../lib/api-client';
import * as conversationsService from './conversations.service';
import type {
  ConversationTurnResult,
  ConversationMessageStreamEvent,
  PublicConversationDetail,
  PublicConversationMessage,
  SelectedConversationRefreshResult,
} from './conversations.types';
import { useConversationMessaging } from './use-conversation-messaging';

vi.mock('./conversations.service', async (importOriginal) => {
  const original = await importOriginal<typeof import('./conversations.service')>();

  return {
    ...original,
    streamConversationMessage: vi.fn(),
  };
});

const previousUserMessage: PublicConversationMessage = {
  id: 'previous-user-id',
  role: 'USER',
  content: 'Previous question',
  createdAt: '2026-07-29T08:00:00.000Z',
  sources: [],
};

const turn: ConversationTurnResult = {
  message: {
    id: 'assistant-message-id',
    role: 'ASSISTANT',
    content: 'Grounded answer',
    createdAt: '2026-07-29T08:02:00.000Z',
  },
  sources: [],
};

function detail(messages: PublicConversationMessage[]): PublicConversationDetail {
  return {
    id: 'conversation-a',
    title: 'Updated title',
    createdAt: '2026-07-29T08:00:00.000Z',
    updatedAt: '2026-07-29T08:02:00.000Z',
    messages,
  };
}

function successfulRefresh(
  messages: PublicConversationMessage[],
): SelectedConversationRefreshResult {
  return { data: detail(messages), status: 'success' };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(conversationsService.streamConversationMessage).mockResolvedValue(turn);
});

describe('useConversationMessaging', () => {
  it('exposes immediate retrieval state and appends real stream deltas progressively', async () => {
    const request = deferred<ConversationTurnResult>();
    let emitEvent: ((event: ConversationMessageStreamEvent) => void) | undefined;
    vi.mocked(conversationsService.streamConversationMessage).mockImplementation(
      async (_conversationId, _content, options) => {
        emitEvent = options.onEvent;
        return request.promise;
      },
    );
    const refreshConversation = vi
      .fn()
      .mockResolvedValue(
        successfulRefresh([previousUserMessage, { ...turn.message, sources: [] }]),
      );
    const { result } = renderHook(() =>
      useConversationMessaging({
        conversationId: 'conversation-a',
        messages: [previousUserMessage],
        onConversationActivity: vi.fn(),
        refreshConversation,
      }),
    );

    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.submit('Question');
    });

    expect(result.current.resource).toMatchObject({
      pendingContent: 'Question',
      phase: 'starting',
      status: 'submitting',
      streamedAnswer: '',
    });

    act(() => {
      emitEvent?.({ type: 'status', phase: 'generating' });
      emitEvent?.({ type: 'delta', delta: 'First ' });
      emitEvent?.({ type: 'delta', delta: 'tokens' });
    });

    expect(result.current.resource).toMatchObject({
      phase: 'generating',
      status: 'submitting',
      streamedAnswer: 'First tokens',
    });

    await act(async () => {
      request.resolve(turn);
      await pending;
    });
  });

  it('submits once, reloads authoritative messages, and announces conversation activity', async () => {
    const onConversationActivity = vi.fn();
    const refreshConversation = vi.fn().mockResolvedValue(
      successfulRefresh([
        previousUserMessage,
        {
          id: 'server-user-id',
          role: 'USER',
          content: 'Where should I store it?',
          createdAt: '2026-07-29T08:01:00.000Z',
          sources: [],
        },
        { ...turn.message, sources: [] },
      ]),
    );
    const { result } = renderHook(() =>
      useConversationMessaging({
        conversationId: 'conversation-a',
        messages: [previousUserMessage],
        onConversationActivity,
        refreshConversation,
      }),
    );

    let outcome;
    await act(async () => {
      outcome = await result.current.submit('  Where should I store it?  ');
    });

    expect(conversationsService.streamConversationMessage).toHaveBeenCalledWith(
      'conversation-a',
      'Where should I store it?',
      expect.objectContaining({ signal: expect.any(AbortSignal), onEvent: expect.any(Function) }),
    );
    expect(refreshConversation).toHaveBeenCalledOnce();
    expect(onConversationActivity).toHaveBeenCalledOnce();
    expect(outcome).toEqual({ clearDraft: true, status: 'success' });
    expect(result.current.resource).toMatchObject({
      assistantMessageId: 'assistant-message-id',
      status: 'success',
    });
  });

  it('deduplicates repeated sends while one state-changing request is active', async () => {
    const request = deferred<ConversationTurnResult>();
    vi.mocked(conversationsService.streamConversationMessage).mockReturnValue(request.promise);
    const refreshConversation = vi
      .fn()
      .mockResolvedValue(
        successfulRefresh([previousUserMessage, { ...turn.message, sources: [] }]),
      );
    const { result } = renderHook(() =>
      useConversationMessaging({
        conversationId: 'conversation-a',
        messages: [previousUserMessage],
        onConversationActivity: vi.fn(),
        refreshConversation,
      }),
    );

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    act(() => {
      first = result.current.submit('Question');
      second = result.current.submit('Question');
    });

    expect(first).toBe(second);
    expect(conversationsService.streamConversationMessage).toHaveBeenCalledOnce();
    expect(result.current.isSubmittingCurrent).toBe(true);

    await act(async () => {
      request.resolve(turn);
      await first;
    });

    expect(refreshConversation).toHaveBeenCalledOnce();
    expect(result.current.isBusy).toBe(false);
  });

  it('preserves the draft outcome when backend compensation removed a failed USER message', async () => {
    vi.mocked(conversationsService.streamConversationMessage).mockRejectedValue(
      new ApiClientError({
        code: 'AI_PROVIDER_UNAVAILABLE',
        kind: 'server',
        message: 'The service is temporarily unavailable. Try again later.',
        status: 503,
      }),
    );
    const refreshConversation = vi.fn().mockResolvedValue(successfulRefresh([previousUserMessage]));
    const onConversationActivity = vi.fn();
    const { result } = renderHook(() =>
      useConversationMessaging({
        conversationId: 'conversation-a',
        messages: [previousUserMessage],
        onConversationActivity,
        refreshConversation,
      }),
    );

    let outcome;
    await act(async () => {
      outcome = await result.current.submit('Question');
    });

    expect(outcome).toEqual({ clearDraft: false, status: 'error' });
    expect(refreshConversation).toHaveBeenCalledOnce();
    expect(onConversationActivity).not.toHaveBeenCalled();
    expect(result.current.resource).toMatchObject({
      questionPersisted: false,
      status: 'error',
    });
  });

  it('clears a matching draft only after authoritative refresh confirms partial USER persistence', async () => {
    vi.mocked(conversationsService.streamConversationMessage).mockRejectedValue(
      new ApiClientError({
        code: 'MESSAGE_PERSISTENCE_FAILED',
        kind: 'server',
        message: 'The service is temporarily unavailable. Try again later.',
        status: 500,
      }),
    );
    const persistedUser: PublicConversationMessage = {
      id: 'new-server-user-id',
      role: 'USER',
      content: 'Question',
      createdAt: '2026-07-29T08:01:00.000Z',
      sources: [],
    };
    const refreshConversation = vi
      .fn()
      .mockResolvedValue(successfulRefresh([previousUserMessage, persistedUser]));
    const onConversationActivity = vi.fn();
    const { result } = renderHook(() =>
      useConversationMessaging({
        conversationId: 'conversation-a',
        messages: [previousUserMessage],
        onConversationActivity,
        refreshConversation,
      }),
    );

    let outcome;
    await act(async () => {
      outcome = await result.current.submit('Question');
    });

    expect(outcome).toEqual({ clearDraft: true, status: 'error' });
    expect(onConversationActivity).toHaveBeenCalledOnce();
    expect(result.current.resource).toMatchObject({
      questionPersisted: true,
      status: 'error',
    });
  });

  it('recovers a complete persisted turn after an ambiguous response failure without resending', async () => {
    vi.mocked(conversationsService.streamConversationMessage).mockRejectedValue(
      new ApiClientError({
        code: 'INVALID_API_RESPONSE',
        kind: 'unexpected',
        message: 'The service returned an unexpected response. Try again.',
      }),
    );
    const persistedUser: PublicConversationMessage = {
      id: 'new-server-user-id',
      role: 'USER',
      content: 'Question',
      createdAt: '2026-07-29T08:01:00.000Z',
      sources: [],
    };
    const refreshConversation = vi
      .fn()
      .mockResolvedValue(
        successfulRefresh([previousUserMessage, persistedUser, { ...turn.message, sources: [] }]),
      );
    const onConversationActivity = vi.fn();
    const { result } = renderHook(() =>
      useConversationMessaging({
        conversationId: 'conversation-a',
        messages: [previousUserMessage],
        onConversationActivity,
        refreshConversation,
      }),
    );

    let outcome;
    await act(async () => {
      outcome = await result.current.submit('Question');
    });

    expect(outcome).toEqual({ clearDraft: true, status: 'success' });
    expect(conversationsService.streamConversationMessage).toHaveBeenCalledOnce();
    expect(refreshConversation).toHaveBeenCalledOnce();
    expect(onConversationActivity).toHaveBeenCalledOnce();
    expect(result.current.resource).toMatchObject({
      assistantMessageId: 'assistant-message-id',
      status: 'success',
    });
  });

  it('does not call the API or reconciliation read for definite client validation failure', async () => {
    const refreshConversation = vi.fn();
    const { result } = renderHook(() =>
      useConversationMessaging({
        conversationId: 'conversation-a',
        messages: [],
        onConversationActivity: vi.fn(),
        refreshConversation,
      }),
    );

    await act(async () => {
      await result.current.submit(' \n\t ');
    });

    expect(conversationsService.streamConversationMessage).not.toHaveBeenCalled();
    expect(refreshConversation).not.toHaveBeenCalled();
    expect(result.current.resource).toMatchObject({ status: 'error' });
  });

  it('does not apply conversation A completion after navigation to conversation B', async () => {
    const request = deferred<ConversationTurnResult>();
    vi.mocked(conversationsService.streamConversationMessage).mockReturnValue(request.promise);
    const refreshConversation = vi.fn();
    const onConversationActivity = vi.fn();
    const { result, rerender } = renderHook(
      ({ conversationId }) =>
        useConversationMessaging({
          conversationId,
          messages: [],
          onConversationActivity,
          refreshConversation,
        }),
      { initialProps: { conversationId: 'conversation-a' } },
    );

    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.submit('Question for A');
    });
    rerender({ conversationId: 'conversation-b' });

    await act(async () => {
      request.resolve(turn);
      await pending;
    });

    expect(refreshConversation).not.toHaveBeenCalled();
    expect(onConversationActivity).not.toHaveBeenCalled();
    expect(result.current.resource.status).toBe('idle');
    expect(result.current.isBusy).toBe(false);
  });

  it('aborts the stream and does not update state after unmount', async () => {
    const request = deferred<ConversationTurnResult>();
    vi.mocked(conversationsService.streamConversationMessage).mockReturnValue(request.promise);
    const refreshConversation = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result, unmount } = renderHook(() =>
      useConversationMessaging({
        conversationId: 'conversation-a',
        messages: [],
        onConversationActivity: vi.fn(),
        refreshConversation,
      }),
    );

    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.submit('Question');
    });
    unmount();

    const streamOptions = vi.mocked(conversationsService.streamConversationMessage).mock
      .calls[0]?.[2];
    expect(streamOptions?.signal?.aborted).toBe(true);

    await act(async () => {
      request.resolve(turn);
      await pending;
    });

    expect(refreshConversation).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
