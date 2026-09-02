import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../../lib/api-client';
import * as documentsService from './documents.service';
import type { PublicDocumentDetails } from './documents.types';
import { useRetryDocument } from './use-retry-document';

vi.mock('./documents.service', async (importOriginal) => {
  const original = await importOriginal<typeof import('./documents.service')>();

  return {
    ...original,
    retryDocumentProcessing: vi.fn(),
  };
});

const processingDocument: PublicDocumentDetails = {
  id: 'document-id',
  filename: 'Authentication Guide.pdf',
  mimeType: 'application/pdf',
  size: 1_887_436,
  status: 'processing',
  processingState: 'PROCESSING',
  processingError: null,
  createdAt: '2026-07-29T08:00:00.000Z',
  updatedAt: '2026-07-29T09:45:00.000Z',
  processedAt: null,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function renderRetryHook(overrides: Partial<Parameters<typeof useRetryDocument>[0]> = {}) {
  const onRetried = vi.fn();
  const onStateChanged = vi.fn();
  const onUnavailable = vi.fn();
  const result = renderHook(
    ({ documentId }) =>
      useRetryDocument({
        documentId,
        onRetried,
        onStateChanged,
        onUnavailable,
        ...overrides,
      }),
    {
      initialProps: { documentId: 'document-id' },
    },
  );

  return { ...result, onRetried, onStateChanged, onUnavailable };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(documentsService.retryDocumentProcessing).mockResolvedValue(processingDocument);
});

describe('useRetryDocument', () => {
  it('opens and cancels confirmation without sending a request', () => {
    const { result } = renderRetryHook();

    act(() => result.current.openDialog());
    expect(result.current.resource.status).toBe('confirming');
    expect(result.current.isDialogOpen).toBe(true);

    act(() => result.current.closeDialog());
    expect(result.current.resource.status).toBe('idle');
    expect(result.current.isDialogOpen).toBe(false);
    expect(documentsService.retryDocumentProcessing).not.toHaveBeenCalled();
  });

  it('submits once after confirmation and returns the same document in Processing', async () => {
    const { onRetried, result } = renderRetryHook();

    act(() => result.current.openDialog());
    await act(async () => {
      await result.current.confirmRetry();
    });

    expect(documentsService.retryDocumentProcessing).toHaveBeenCalledOnce();
    expect(documentsService.retryDocumentProcessing).toHaveBeenCalledWith('document-id');
    expect(result.current.resource.status).toBe('success');
    expect(result.current.isDialogOpen).toBe(false);
    expect(onRetried).toHaveBeenCalledWith(processingDocument);
    expect(onRetried.mock.calls[0]?.[0].id).toBe('document-id');
  });

  it('returns the active promise and blocks duplicate Retry requests', async () => {
    const request = deferred<PublicDocumentDetails>();
    vi.mocked(documentsService.retryDocumentProcessing).mockReturnValue(request.promise);
    const { result } = renderRetryHook();

    act(() => result.current.openDialog());
    let firstRequest!: Promise<void>;
    let secondRequest!: Promise<void>;
    act(() => {
      firstRequest = result.current.confirmRetry();
      secondRequest = result.current.confirmRetry();
    });

    expect(firstRequest).toBe(secondRequest);
    expect(result.current.resource.status).toBe('retrying');
    expect(result.current.isRetrying).toBe(true);
    expect(documentsService.retryDocumentProcessing).toHaveBeenCalledOnce();

    await act(async () => {
      request.resolve(processingDocument);
      await firstRequest;
    });
  });

  it('keeps safe Failed-state feedback retryable after a server failure', async () => {
    vi.mocked(documentsService.retryDocumentProcessing)
      .mockRejectedValueOnce(
        new ApiClientError({
          code: 'PROCESSING_QUEUE_UNAVAILABLE',
          kind: 'server',
          message: 'Processing could not be restarted right now. Try again.',
          status: 503,
        }),
      )
      .mockResolvedValueOnce(processingDocument);
    const { onRetried, result } = renderRetryHook();

    act(() => result.current.openDialog());
    await act(async () => {
      await result.current.confirmRetry();
    });

    expect(result.current.resource.status).toBe('error');
    expect(result.current.isDialogOpen).toBe(true);
    if (result.current.resource.status === 'error') {
      expect(result.current.resource.error.message).toBe(
        'Processing could not be restarted right now. Try again.',
      );
    }

    await act(async () => {
      await result.current.confirmRetry();
    });

    expect(documentsService.retryDocumentProcessing).toHaveBeenCalledTimes(2);
    expect(onRetried).toHaveBeenCalledOnce();
  });

  it('maps a hidden not-found race to one unavailable callback', async () => {
    vi.mocked(documentsService.retryDocumentProcessing).mockRejectedValue(
      new ApiClientError({
        code: 'DOCUMENT_NOT_FOUND',
        kind: 'unexpected',
        message: 'The request could not be completed.',
        status: 404,
      }),
    );
    const { onRetried, onUnavailable, result } = renderRetryHook();

    act(() => result.current.openDialog());
    await act(async () => {
      await result.current.confirmRetry();
    });

    expect(result.current.resource.status).toBe('success');
    expect(onUnavailable).toHaveBeenCalledOnce();
    expect(onRetried).not.toHaveBeenCalled();
  });

  it('requests one controlled status refresh after an invalid-state race', async () => {
    vi.mocked(documentsService.retryDocumentProcessing).mockRejectedValue(
      new ApiClientError({
        code: 'INVALID_DOCUMENT_STATE',
        kind: 'conflict',
        message: 'The document status changed. Refresh to view its latest state.',
        status: 409,
      }),
    );
    const { onRetried, onStateChanged, result } = renderRetryHook();

    act(() => result.current.openDialog());
    await act(async () => {
      await result.current.confirmRetry();
    });

    expect(result.current.resource.status).toBe('success');
    expect(onStateChanged).toHaveBeenCalledOnce();
    expect(onRetried).not.toHaveBeenCalled();
  });

  it('lets the submitted request finish after unmount without firing callbacks', async () => {
    const request = deferred<PublicDocumentDetails>();
    vi.mocked(documentsService.retryDocumentProcessing).mockReturnValue(request.promise);
    const { onRetried, onStateChanged, onUnavailable, result, unmount } = renderRetryHook();

    act(() => result.current.openDialog());
    let retry!: Promise<void>;
    act(() => {
      retry = result.current.confirmRetry();
    });
    unmount();

    request.resolve(processingDocument);
    await retry;

    expect(onRetried).not.toHaveBeenCalled();
    expect(onStateChanged).not.toHaveBeenCalled();
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it('does not apply an old Retry response after the route document changes', async () => {
    const request = deferred<PublicDocumentDetails>();
    vi.mocked(documentsService.retryDocumentProcessing).mockReturnValue(request.promise);
    const { onRetried, rerender, result } = renderRetryHook();

    act(() => result.current.openDialog());
    let retry!: Promise<void>;
    act(() => {
      retry = result.current.confirmRetry();
    });
    rerender({ documentId: 'new-document-id' });

    request.resolve(processingDocument);
    await retry;

    expect(onRetried).not.toHaveBeenCalled();
  });
});
