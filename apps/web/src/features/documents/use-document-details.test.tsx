import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../../lib/api-client';
import * as documentsService from './documents.service';
import type { PublicDocumentDetails } from './documents.types';
import { useDocumentDetails } from './use-document-details';

vi.mock('./documents.service', async (importOriginal) => {
  const original = await importOriginal<typeof import('./documents.service')>();

  return {
    ...original,
    getDocumentById: vi.fn(),
  };
});

const readyDocument: PublicDocumentDetails = {
  id: 'ready-document',
  filename: 'Authentication Guide.pdf',
  mimeType: 'application/pdf',
  size: 1_887_436,
  status: 'ready',
  processingError: null,
  createdAt: '2026-07-29T08:00:00.000Z',
  updatedAt: '2026-07-29T08:05:00.000Z',
  processedAt: '2026-07-29T08:05:00.000Z',
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
  vi.mocked(documentsService.getDocumentById).mockResolvedValue(readyDocument);
});

describe('useDocumentDetails', () => {
  it('exposes loading and then loads the current document once', async () => {
    const { result } = renderHook(() => useDocumentDetails('ready-document'));

    expect(result.current.resource.status).toBe('loading');

    await waitFor(() => {
      expect(result.current.resource.status).toBe('success');
    });

    expect(documentsService.getDocumentById).toHaveBeenCalledOnce();
    expect(documentsService.getDocumentById).toHaveBeenCalledWith(
      'ready-document',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('refreshes the current document while preserving visible data', async () => {
    const refreshed = deferred<PublicDocumentDetails>();
    vi.mocked(documentsService.getDocumentById)
      .mockResolvedValueOnce(readyDocument)
      .mockReturnValueOnce(refreshed.promise);
    const { result } = renderHook(() => useDocumentDetails('ready-document'));
    await waitFor(() => expect(result.current.resource.status).toBe('success'));

    act(() => {
      void result.current.refresh();
    });

    expect(result.current.resource.status).toBe('success');
    if (result.current.resource.status === 'success') {
      expect(result.current.resource.data).toBe(readyDocument);
      expect(result.current.resource.isRefreshing).toBe(true);
    }

    await act(async () => {
      refreshed.resolve({
        ...readyDocument,
        status: 'failed',
        processingError: 'Safe processing error',
      });
      await refreshed.promise;
    });

    expect(result.current.resource.status).toBe('success');
    if (result.current.resource.status === 'success') {
      expect(result.current.resource.data.status).toBe('failed');
      expect(result.current.resource.isRefreshing).toBe(false);
    }
  });

  it('prevents duplicate simultaneous refresh requests', async () => {
    const refreshed = deferred<PublicDocumentDetails>();
    vi.mocked(documentsService.getDocumentById)
      .mockResolvedValueOnce(readyDocument)
      .mockReturnValueOnce(refreshed.promise);
    const { result } = renderHook(() => useDocumentDetails('ready-document'));
    await waitFor(() => expect(result.current.resource.status).toBe('success'));

    let firstRequest!: Promise<void>;
    let secondRequest!: Promise<void>;

    act(() => {
      firstRequest = result.current.refresh();
      secondRequest = result.current.refresh();
    });

    expect(firstRequest).toBe(secondRequest);
    expect(documentsService.getDocumentById).toHaveBeenCalledTimes(2);

    await act(async () => {
      refreshed.resolve(readyDocument);
      await firstRequest;
    });
  });

  it('replaces visible data with a server-confirmed Retry response', async () => {
    const processingDocument: PublicDocumentDetails = {
      ...readyDocument,
      status: 'processing',
      processingError: null,
      processedAt: null,
      updatedAt: '2026-07-29T09:45:00.000Z',
    };
    const { result } = renderHook(() => useDocumentDetails('ready-document'));
    await waitFor(() => expect(result.current.resource.status).toBe('success'));

    let replaced = false;
    act(() => {
      replaced = result.current.replaceDocument(processingDocument);
    });

    expect(replaced).toBe(true);
    expect(result.current.resource.status).toBe('success');
    if (result.current.resource.status === 'success') {
      expect(result.current.resource.data).toBe(processingDocument);
      expect(result.current.resource.data.status).toBe('processing');
      expect(result.current.resource.data.processingError).toBeNull();
      expect(result.current.resource.isRefreshing).toBe(false);
    }
  });

  it('does not let an older Refresh restore Failed data after a confirmed Retry', async () => {
    const refreshed = deferred<PublicDocumentDetails>();
    vi.mocked(documentsService.getDocumentById)
      .mockResolvedValueOnce({
        ...readyDocument,
        status: 'failed',
        processingError: 'Old failure',
        processedAt: null,
      })
      .mockReturnValueOnce(refreshed.promise);
    const { result } = renderHook(() => useDocumentDetails('ready-document'));
    await waitFor(() => expect(result.current.resource.status).toBe('success'));

    let refreshRequest!: Promise<void>;
    act(() => {
      refreshRequest = result.current.refresh();
    });

    act(() => {
      result.current.replaceDocument({
        ...readyDocument,
        status: 'processing',
        processingError: null,
        processedAt: null,
        updatedAt: '2026-07-29T09:45:00.000Z',
      });
    });

    await act(async () => {
      refreshed.resolve({
        ...readyDocument,
        status: 'failed',
        processingError: 'Stale failure',
        processedAt: null,
      });
      await refreshRequest;
    });

    expect(result.current.resource.status).toBe('success');
    if (result.current.resource.status === 'success') {
      expect(result.current.resource.data.status).toBe('processing');
      expect(result.current.resource.data.processingError).toBeNull();
    }
  });

  it('rejects a server result for a different route document', async () => {
    const { result } = renderHook(() => useDocumentDetails('ready-document'));
    await waitFor(() => expect(result.current.resource.status).toBe('success'));

    let replaced = true;
    act(() => {
      replaced = result.current.replaceDocument({
        ...readyDocument,
        id: 'different-document',
        status: 'processing',
      });
    });

    expect(replaced).toBe(false);
    expect(result.current.resource.status).toBe('success');
    if (result.current.resource.status === 'success') {
      expect(result.current.resource.data).toBe(readyDocument);
    }
  });

  it('does not allow an older document response to replace a newer route result', async () => {
    const firstRequest = deferred<PublicDocumentDetails>();
    vi.mocked(documentsService.getDocumentById)
      .mockReturnValueOnce(firstRequest.promise)
      .mockResolvedValueOnce({
        ...readyDocument,
        id: 'new-document',
        filename: 'New document.pdf',
      });
    const { rerender, result } = renderHook(({ documentId }) => useDocumentDetails(documentId), {
      initialProps: { documentId: 'old-document' },
    });
    await waitFor(() => expect(documentsService.getDocumentById).toHaveBeenCalledOnce());

    rerender({ documentId: 'new-document' });

    await waitFor(() => {
      if (result.current.resource.status !== 'success') {
        throw new Error('New document has not loaded');
      }

      expect(result.current.resource.data.filename).toBe('New document.pdf');
    });

    await act(async () => {
      firstRequest.resolve({
        ...readyDocument,
        id: 'old-document',
        filename: 'Stale document.pdf',
      });
      await firstRequest.promise;
    });

    expect(result.current.resource.status).toBe('success');
    if (result.current.resource.status === 'success') {
      expect(result.current.resource.data.filename).toBe('New document.pdf');
    }
  });

  it('aborts the active request after unmount', async () => {
    const request = deferred<PublicDocumentDetails>();
    let signal: AbortSignal | undefined;
    vi.mocked(documentsService.getDocumentById).mockImplementation((_documentId, options) => {
      signal = options?.signal;
      return request.promise;
    });
    const { unmount } = renderHook(() => useDocumentDetails('ready-document'));
    await waitFor(() => expect(signal).toBeDefined());

    unmount();

    expect(signal?.aborted).toBe(true);
  });

  it('preserves loaded data and exposes a scoped refresh error', async () => {
    vi.mocked(documentsService.getDocumentById)
      .mockResolvedValueOnce(readyDocument)
      .mockRejectedValueOnce(
        new ApiClientError({
          code: 'NETWORK_ERROR',
          kind: 'network',
          message: 'Unable to connect to the service.',
        }),
      );
    const { result } = renderHook(() => useDocumentDetails('ready-document'));
    await waitFor(() => expect(result.current.resource.status).toBe('success'));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.resource.status).toBe('success');
    if (result.current.resource.status === 'success') {
      expect(result.current.resource.data).toBe(readyDocument);
      expect(result.current.resource.refreshError?.code).toBe('NETWORK_ERROR');
    }
  });

  it('maps missing, foreign-owned, or deleted documents to one not-found state', async () => {
    vi.mocked(documentsService.getDocumentById).mockRejectedValue(
      new ApiClientError({
        code: 'DOCUMENT_NOT_FOUND',
        kind: 'unexpected',
        message: 'The request could not be completed.',
        status: 404,
      }),
    );
    const { result } = renderHook(() => useDocumentDetails('missing-document'));

    await waitFor(() => expect(result.current.resource.status).toBe('not-found'));
  });

  it('renders an invalid route as not found without sending an API request', async () => {
    const { result } = renderHook(() => useDocumentDetails('invalid/document'));

    await waitFor(() => expect(result.current.resource.status).toBe('not-found'));
    expect(documentsService.getDocumentById).not.toHaveBeenCalled();
  });
});
