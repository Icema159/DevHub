import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../../lib/api-client';
import * as documentsService from './documents.service';
import type { PublicDeletedDocument } from './documents.types';
import { useDeleteDocument } from './use-delete-document';

vi.mock('./documents.service', async (importOriginal) => {
  const original = await importOriginal<typeof import('./documents.service')>();

  return {
    ...original,
    deleteDocument: vi.fn(),
  };
});

const deletedDocument: PublicDeletedDocument = {
  id: 'document-id',
  deletedAt: '2026-07-29T09:30:00.000Z',
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

function renderDeleteHook(overrides: Partial<Parameters<typeof useDeleteDocument>[0]> = {}) {
  const onDeleted = vi.fn();
  const onUnavailable = vi.fn();
  const result = renderHook(() =>
    useDeleteDocument({
      documentId: 'document-id',
      onDeleted,
      onUnavailable,
      ...overrides,
    }),
  );

  return { ...result, onDeleted, onUnavailable };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(documentsService.deleteDocument).mockResolvedValue(deletedDocument);
});

describe('useDeleteDocument', () => {
  it('opens and closes confirmation without sending a request', () => {
    const { result } = renderDeleteHook();

    act(() => result.current.openDialog());
    expect(result.current.resource.status).toBe('confirming');
    expect(result.current.isDialogOpen).toBe(true);

    act(() => result.current.closeDialog());
    expect(result.current.resource.status).toBe('idle');
    expect(result.current.isDialogOpen).toBe(false);
    expect(documentsService.deleteDocument).not.toHaveBeenCalled();
  });

  it('deletes only after confirmation and reports the accepted result', async () => {
    const { onDeleted, onUnavailable, result } = renderDeleteHook();

    act(() => result.current.openDialog());
    await act(async () => {
      await result.current.confirmDelete();
    });

    expect(documentsService.deleteDocument).toHaveBeenCalledOnce();
    expect(documentsService.deleteDocument).toHaveBeenCalledWith('document-id');
    expect(result.current.resource.status).toBe('success');
    expect(result.current.isDialogOpen).toBe(false);
    expect(onDeleted).toHaveBeenCalledWith(deletedDocument);
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it('returns the active promise and prevents duplicate destructive requests', async () => {
    const request = deferred<PublicDeletedDocument>();
    vi.mocked(documentsService.deleteDocument).mockReturnValue(request.promise);
    const { result } = renderDeleteHook();

    act(() => result.current.openDialog());

    let firstRequest!: Promise<void>;
    let secondRequest!: Promise<void>;
    act(() => {
      firstRequest = result.current.confirmDelete();
      secondRequest = result.current.confirmDelete();
    });

    expect(firstRequest).toBe(secondRequest);
    expect(result.current.resource.status).toBe('deleting');
    expect(result.current.isDeleting).toBe(true);
    expect(documentsService.deleteDocument).toHaveBeenCalledOnce();

    await act(async () => {
      request.resolve(deletedDocument);
      await firstRequest;
    });
  });

  it('keeps the confirmation open after a retryable failure and retries explicitly', async () => {
    vi.mocked(documentsService.deleteDocument)
      .mockRejectedValueOnce(
        new ApiClientError({
          code: 'DOCUMENT_DELETION_QUEUE_UNAVAILABLE',
          kind: 'server',
          message: 'The document could not be deleted right now. Try again.',
          status: 503,
        }),
      )
      .mockResolvedValueOnce(deletedDocument);
    const { onDeleted, result } = renderDeleteHook();

    act(() => result.current.openDialog());
    await act(async () => {
      await result.current.confirmDelete();
    });

    expect(result.current.resource.status).toBe('error');
    expect(result.current.isDialogOpen).toBe(true);
    if (result.current.resource.status === 'error') {
      expect(result.current.resource.error.message).toBe(
        'The document could not be deleted right now. Try again.',
      );
    }

    await act(async () => {
      await result.current.confirmDelete();
    });

    expect(documentsService.deleteDocument).toHaveBeenCalledTimes(2);
    expect(onDeleted).toHaveBeenCalledOnce();
  });

  it('treats an owner-hidden not-found race as unavailable rather than successful deletion', async () => {
    vi.mocked(documentsService.deleteDocument).mockRejectedValue(
      new ApiClientError({
        code: 'DOCUMENT_NOT_FOUND',
        kind: 'unexpected',
        message: 'The request could not be completed.',
        status: 404,
      }),
    );
    const { onDeleted, onUnavailable, result } = renderDeleteHook();

    act(() => result.current.openDialog());
    await act(async () => {
      await result.current.confirmDelete();
    });

    expect(result.current.resource.status).toBe('success');
    expect(onUnavailable).toHaveBeenCalledOnce();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('lets an accepted destructive request finish after unmount without firing callbacks', async () => {
    const request = deferred<PublicDeletedDocument>();
    vi.mocked(documentsService.deleteDocument).mockReturnValue(request.promise);
    const { onDeleted, onUnavailable, result, unmount } = renderDeleteHook();

    act(() => result.current.openDialog());
    let deletion!: Promise<void>;
    act(() => {
      deletion = result.current.confirmDelete();
    });

    unmount();
    request.resolve(deletedDocument);
    await deletion;

    expect(onDeleted).not.toHaveBeenCalled();
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it('ignores confirmation unless the dialog is open', async () => {
    const { result } = renderDeleteHook();

    await act(async () => {
      await result.current.confirmDelete();
    });

    expect(documentsService.deleteDocument).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.resource.status).toBe('idle'));
  });
});
