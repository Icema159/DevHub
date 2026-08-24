import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../../lib/api-client';
import * as documentsService from './documents.service';
import type { DocumentList, PublicDocument } from './documents.types';
import { useDocuments } from './use-documents';

vi.mock('./documents.service', () => ({
  getDocuments: vi.fn(),
  uploadDocument: vi.fn(),
}));

function documentList(filename = 'Authentication Guide.pdf'): DocumentList {
  return {
    documents: [
      {
        id: filename,
        filename,
        mimeType: 'application/pdf',
        size: 1_024,
        status: 'ready',
        createdAt: '2026-07-29T08:00:00.000Z',
        updatedAt: '2026-07-29T08:05:00.000Z',
        processedAt: '2026-07-29T08:05:00.000Z',
      },
    ],
    meta: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      statusCounts: { all: 1, ready: 1, processing: 0, failed: 0 },
    },
  };
}

const uploadedDocument: PublicDocument = {
  id: 'uploaded',
  filename: 'Uploaded.pdf',
  mimeType: 'application/pdf',
  size: 1_024,
  status: 'processing',
  createdAt: '2026-07-29T09:00:00.000Z',
  updatedAt: '2026-07-29T09:00:00.000Z',
  processedAt: null,
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
  vi.mocked(documentsService.getDocuments).mockImplementation(async (query) => {
    const data = documentList();

    return {
      ...data,
      meta: {
        ...data.meta,
        page: query.page,
        total: 60,
        totalPages: 3,
      },
    };
  });
  vi.mocked(documentsService.uploadDocument).mockResolvedValue(uploadedDocument);
});

describe('useDocuments', () => {
  it('loads the first page once with the default public query', async () => {
    const { result } = renderHook(() => useDocuments());

    expect(result.current.resource.status).toBe('loading');

    await waitFor(() => {
      expect(result.current.resource.status).toBe('success');
    });

    expect(documentsService.getDocuments).toHaveBeenCalledWith(
      { page: 1, limit: 20, status: 'ALL' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('debounces and trims filename search before requesting page one', async () => {
    const { result } = renderHook(() => useDocuments());
    await waitFor(() => expect(result.current.resource.status).toBe('success'));

    act(() => {
      result.current.setPage(2);
    });
    await waitFor(() => expect(documentsService.getDocuments).toHaveBeenCalledTimes(2));

    act(() => {
      result.current.setSearchInput('  JWT  ');
      result.current.setSearchInput('  JWT Guide  ');
    });

    expect(documentsService.getDocuments).toHaveBeenCalledTimes(2);

    await waitFor(
      () => {
        expect(documentsService.getDocuments).toHaveBeenLastCalledWith(
          { page: 1, limit: 20, search: 'JWT Guide', status: 'ALL' },
          expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
      },
      { timeout: 1_000 },
    );
  });

  it('resets page for a filter and retains active search while paginating', async () => {
    const { result } = renderHook(() => useDocuments());
    await waitFor(() => expect(result.current.resource.status).toBe('success'));

    act(() => {
      result.current.setSearchInput('Prisma');
    });
    await waitFor(() => expect(result.current.effectiveSearch).toBe('Prisma'), { timeout: 1_000 });

    act(() => {
      result.current.setPage(3);
    });
    await waitFor(() =>
      expect(documentsService.getDocuments).toHaveBeenLastCalledWith(
        { page: 3, limit: 20, search: 'Prisma', status: 'ALL' },
        expect.anything(),
      ),
    );

    act(() => {
      result.current.setStatus('FAILED');
    });

    await waitFor(() =>
      expect(documentsService.getDocuments).toHaveBeenLastCalledWith(
        { page: 1, limit: 20, search: 'Prisma', status: 'FAILED' },
        expect.anything(),
      ),
    );
  });

  it('prevents an older response from replacing a newer filter result', async () => {
    const slowReady = deferred<DocumentList>();
    vi.mocked(documentsService.getDocuments)
      .mockResolvedValueOnce(documentList('Initial.pdf'))
      .mockReturnValueOnce(slowReady.promise)
      .mockResolvedValueOnce(documentList('Failed result.pdf'));

    const { result } = renderHook(() => useDocuments());
    await waitFor(() => expect(result.current.resource.status).toBe('success'));

    act(() => {
      result.current.setStatus('READY');
    });
    await waitFor(() => expect(documentsService.getDocuments).toHaveBeenCalledTimes(2));

    act(() => {
      result.current.setStatus('FAILED');
    });
    await waitFor(() => {
      if (result.current.resource.status !== 'success') throw new Error('Not loaded');
      expect(result.current.resource.data.documents[0]?.filename).toBe('Failed result.pdf');
    });

    await act(async () => {
      slowReady.resolve(documentList('Stale ready result.pdf'));
      await slowReady.promise;
    });

    expect(result.current.resource.status).toBe('success');
    if (result.current.resource.status === 'success') {
      expect(result.current.resource.data.documents[0]?.filename).toBe('Failed result.pdf');
    }
  });

  it('retries after a scoped list failure', async () => {
    vi.mocked(documentsService.getDocuments)
      .mockRejectedValueOnce(
        new ApiClientError({
          code: 'NETWORK_ERROR',
          kind: 'network',
          message: 'Unable to connect.',
        }),
      )
      .mockResolvedValueOnce(documentList());

    const { result } = renderHook(() => useDocuments());
    await waitFor(() => expect(result.current.resource.status).toBe('error'));

    act(() => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.resource.status).toBe('success'));
    expect(documentsService.getDocuments).toHaveBeenCalledTimes(2);
  });

  it('refreshes the active list after upload success', async () => {
    const { result } = renderHook(() => useDocuments());
    await waitFor(() => expect(result.current.resource.status).toBe('success'));
    const file = new File(['%PDF-test'], 'Uploaded.pdf', { type: 'application/pdf' });

    await act(async () => {
      await result.current.upload(file);
    });

    await waitFor(() => expect(documentsService.getDocuments).toHaveBeenCalledTimes(2));
    expect(documentsService.uploadDocument).toHaveBeenCalledOnce();
  });

  it('returns the in-flight upload and prevents duplicate submissions', async () => {
    const pendingUpload = deferred<PublicDocument>();
    vi.mocked(documentsService.uploadDocument).mockReturnValue(pendingUpload.promise);
    const { result } = renderHook(() => useDocuments());
    await waitFor(() => expect(result.current.resource.status).toBe('success'));
    const file = new File(['%PDF-test'], 'Uploaded.pdf', { type: 'application/pdf' });

    let firstPromise!: Promise<PublicDocument>;
    let secondPromise!: Promise<PublicDocument>;

    act(() => {
      firstPromise = result.current.upload(file);
      secondPromise = result.current.upload(file);
    });

    expect(firstPromise).toBe(secondPromise);
    expect(documentsService.uploadDocument).toHaveBeenCalledOnce();
    expect(result.current.isUploading).toBe(true);

    await act(async () => {
      pendingUpload.resolve(uploadedDocument);
      await firstPromise;
    });

    expect(result.current.isUploading).toBe(false);
  });
});
