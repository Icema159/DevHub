import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '../../components/ui';
import { ApiClientError } from '../../lib/api-client';
import * as documentsService from './documents.service';
import type { DocumentDetailsResource, PublicDocumentDetails } from './documents.types';
import { DocumentDetailsPage } from './pages/DocumentDetailsPage';
import { useDocumentDetails } from './use-document-details';

vi.mock('./use-document-details', () => ({
  useDocumentDetails: vi.fn(),
}));

vi.mock('./documents.service', async (importOriginal) => {
  const original = await importOriginal<typeof import('./documents.service')>();

  return {
    ...original,
    deleteDocument: vi.fn(),
    retryDocumentProcessing: vi.fn(),
  };
});

const refresh = vi.fn(async () => undefined);
const replaceDocument = vi.fn(() => true);

const readyDocument: PublicDocumentDetails = {
  id: 'ready-document',
  filename: 'Authentication Guide.pdf',
  mimeType: 'application/pdf',
  size: 1_887_436,
  status: 'ready',
  processingState: 'READY',
  processingError: null,
  createdAt: '2026-07-29T08:00:00.000Z',
  updatedAt: '2026-07-29T08:05:00.000Z',
  processedAt: '2026-07-29T08:05:00.000Z',
};

const failedDocument: PublicDocumentDetails = {
  ...readyDocument,
  status: 'failed',
  processingState: 'FAILED',
  processingError: 'Document embedding generation failed',
  processedAt: null,
};

const processingDocument: PublicDocumentDetails = {
  ...readyDocument,
  status: 'processing',
  processingState: 'PROCESSING',
  processingError: null,
  processedAt: null,
  updatedAt: '2026-07-29T09:45:00.000Z',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function success(
  document: PublicDocumentDetails,
  overrides: Partial<Extract<DocumentDetailsResource, { status: 'success' }>> = {},
): Extract<DocumentDetailsResource, { status: 'success' }> {
  return {
    data: document,
    error: null,
    isRefreshing: false,
    refreshError: null,
    status: 'success',
    ...overrides,
  };
}

function mockDetails(resource: DocumentDetailsResource) {
  vi.mocked(useDocumentDetails).mockReturnValue({ refresh, replaceDocument, resource });
}

function pageView(path = '/documents/ready-document') {
  return (
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider duration={60_000}>
        <Routes>
          <Route path="/documents/:documentId" element={<DocumentDetailsPage />} />
          <Route path="/documents" element={<h1>Documents destination</h1>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
}

function renderPage(path = '/documents/ready-document') {
  return render(pageView(path));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDetails(success(readyDocument));
  vi.mocked(documentsService.deleteDocument).mockResolvedValue({
    id: 'ready-document',
    deletedAt: '2026-07-29T09:30:00.000Z',
  });
  vi.mocked(documentsService.retryDocumentProcessing).mockResolvedValue(processingDocument);
});

describe('Document details page', () => {
  it('renders the filename heading, status, safe metadata, and back link', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Authentication Guide.pdf' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Ready')).not.toHaveLength(0);
    expect(screen.getByText('PDF document')).toBeInTheDocument();
    expect(screen.getByText('application/pdf')).toBeInTheDocument();
    expect(screen.getAllByText('1.8 MB')).not.toHaveLength(0);
    expect(screen.getByText('Processed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to documents' })).toHaveAttribute(
      'href',
      '/documents',
    );
    expect(document.title).toContain('Authentication Guide.pdf');
  });

  it('lets the pipeline itself convey Ready availability, without a redundant banner', () => {
    renderPage();

    expect(screen.getByText('Ready for search')).toBeInTheDocument();
    expect(screen.queryByText('Ready for AI search')).not.toBeInTheDocument();
    expect(
      screen.queryByText('This document can now be used for AI search and grounded answers.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ask/i })).not.toBeInTheDocument();
  });

  it('places lifecycle context before dense metadata in reading order', () => {
    renderPage();

    const statusHeading = screen.getByRole('heading', { name: 'Pipeline' });
    const informationHeading = screen.getByRole('heading', { name: 'Details' });

    expect(
      statusHeading.compareDocumentPosition(informationHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders the pipeline with only backend-tracked timestamps, no invented per-step data', () => {
    renderPage();

    expect(screen.getByText('Uploaded')).toBeInTheDocument();
    expect(screen.getByText('Ready for search')).toBeInTheDocument();
    // Real timestamps only exist for Uploaded (createdAt) and Ready (processedAt).
    expect(screen.getAllByText(/Jul 29, 2026/).length).toBeGreaterThanOrEqual(2);
    // The backend cannot distinguish an exact parse-vs-chunk boundary or expose page
    // counts, fragment counts, or vector dimensions — none of that may appear anywhere.
    expect(
      screen.queryByText(/pages of text extracted|fragments|vectors|dims/i),
    ).not.toBeInTheDocument();
  });

  it('shows honest in-progress pipeline steps for intermediate backend states, without a leaked technical state name', () => {
    mockDetails(
      success({
        ...readyDocument,
        status: 'processing',
        processingState: 'EMBEDDING',
        processedAt: null,
      }),
    );
    renderPage();

    expect(screen.getByText('Parsed')).toBeInTheDocument();
    expect(screen.getByText('Chunked')).toBeInTheDocument();
    expect(screen.getByText('Embedded')).toBeInTheDocument();
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('marks only Uploaded as certain and avoids guessing the failed stage', () => {
    mockDetails(success(failedDocument));
    renderPage();

    expect(screen.getByText('Processing stopped')).toBeInTheDocument();
    expect(screen.queryByText('Parsed')).not.toBeInTheDocument();
    expect(screen.queryByText('Chunked')).not.toBeInTheDocument();
    expect(screen.queryByText('Embedded')).not.toBeInTheDocument();
  });

  it('groups active backend states into the public Processing presentation', () => {
    mockDetails(
      success({
        ...readyDocument,
        status: 'processing',
        processedAt: null,
      }),
    );
    renderPage();

    expect(screen.getAllByText('Processing')).not.toHaveLength(0);
    expect(screen.getByText('Document processing')).toBeInTheDocument();
    expect(
      screen.getByText(/Refresh this page to check for an updated status/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/percentage|queue position|chunks ready|embedding/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Processed')).not.toBeInTheDocument();
  });

  it('renders a public failed-processing error as escaped, constrained plain text', () => {
    const unsafeText = '<img src=x onerror="alert(1)"> Safe public issue';
    mockDetails(
      success({
        ...readyDocument,
        status: 'failed',
        processingError: unsafeText,
        processedAt: null,
      }),
    );
    const { container } = renderPage();

    expect(screen.getAllByText('Failed')).not.toHaveLength(0);
    expect(screen.getByText('Processing issue')).toBeInTheDocument();
    expect(screen.getByText(unsafeText)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('uses generic Failed-state copy when no processing error is available', () => {
    mockDetails(
      success({
        ...readyDocument,
        status: 'failed',
        processingError: null,
        processedAt: null,
      }),
    );
    renderPage();

    expect(screen.getByText('The document could not be processed.')).toBeInTheDocument();
    expect(screen.queryByText('null')).not.toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('renders the initial details skeleton with an assistive loading message', () => {
    mockDetails({
      data: null,
      error: null,
      isRefreshing: false,
      refreshError: null,
      status: 'loading',
    });
    renderPage();

    expect(screen.getByRole('status', { name: 'Loading document details' })).toBeInTheDocument();
    expect(screen.queryByText('Authentication Guide.pdf')).not.toBeInTheDocument();
  });

  it('renders one generic not-found state without ownership disclosure', () => {
    mockDetails({
      data: null,
      error: null,
      isRefreshing: false,
      refreshError: null,
      status: 'not-found',
    });
    renderPage('/documents/foreign-document');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Document not found' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/may no longer exist or may not be available to your account/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/forbidden|another user|owner/i)).not.toBeInTheDocument();
  });

  it('renders a safe recoverable error and retries the current document', async () => {
    const user = userEvent.setup();
    mockDetails({
      data: null,
      error: new ApiClientError({
        code: 'NETWORK_ERROR',
        kind: 'network',
        message: 'Unable to connect to the service. Check your connection and try again.',
      }),
      isRefreshing: false,
      refreshError: null,
      status: 'error',
    });
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Unable to load document' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to connect to the service.');

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('preserves document content and scopes a manual-refresh failure', () => {
    mockDetails(
      success(readyDocument, {
        refreshError: new ApiClientError({
          code: 'NETWORK_ERROR',
          kind: 'network',
          message: 'Unable to connect to the service.',
        }),
      }),
    );
    renderPage();

    expect(screen.getAllByText('Authentication Guide.pdf')).not.toHaveLength(0);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not refresh document');
  });

  it('invokes manual refresh once and exposes the restrained refreshing state', async () => {
    const user = userEvent.setup();
    mockDetails(success(readyDocument, { isRefreshing: true }));
    const refreshingPage = renderPage();

    expect(screen.getByRole('button', { name: 'Refreshing…' })).toBeDisabled();
    refreshingPage.unmount();

    mockDetails(success(readyDocument));
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('renders Retry only for a successfully loaded Failed document', () => {
    const readyPage = renderPage();
    expect(screen.queryByRole('button', { name: 'Retry processing' })).not.toBeInTheDocument();
    readyPage.unmount();

    mockDetails(success(processingDocument));
    const processingPage = renderPage();
    expect(screen.queryByRole('button', { name: 'Retry processing' })).not.toBeInTheDocument();
    processingPage.unmount();

    mockDetails(success(failedDocument));
    renderPage();
    expect(screen.getByRole('button', { name: 'Retry processing' })).toBeEnabled();
  });

  it.each(['loading', 'not-found', 'error'] as const)(
    'does not render Retry in the %s details state',
    (status) => {
      if (status === 'loading' || status === 'not-found') {
        mockDetails({
          data: null,
          error: null,
          isRefreshing: false,
          refreshError: null,
          status,
        });
      } else {
        mockDetails({
          data: null,
          error: new ApiClientError({
            code: 'NETWORK_ERROR',
            kind: 'network',
            message: 'Unable to connect to the service.',
          }),
          isRefreshing: false,
          refreshError: null,
          status,
        });
      }

      renderPage();
      expect(screen.queryByRole('button', { name: 'Retry processing' })).not.toBeInTheDocument();
    },
  );

  it('opens and cancels Retry without sending a request, then restores focus', async () => {
    const user = userEvent.setup();
    mockDetails(success(failedDocument));
    renderPage();
    const trigger = screen.getByRole('button', { name: 'Retry processing' });

    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Retry document processing?' })).toBeVisible();
    expect(documentsService.retryDocumentProcessing).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByRole('dialog', { name: 'Retry document processing?' }),
    ).not.toBeInTheDocument();
    expect(documentsService.retryDocumentProcessing).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it('accepts Retry once, keeps the route, applies Processing, clears the error, and hides Retry', async () => {
    const user = userEvent.setup();
    mockDetails(success(failedDocument));
    const page = renderPage();

    await user.click(screen.getByRole('button', { name: 'Retry processing' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Retry document processing?' })).getByRole(
        'button',
        { name: 'Retry processing' },
      ),
    );

    await waitFor(() => {
      expect(documentsService.retryDocumentProcessing).toHaveBeenCalledOnce();
      expect(replaceDocument).toHaveBeenCalledWith(processingDocument);
    });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Authentication Guide.pdf' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Documents destination' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Processing restarted');

    mockDetails(success(processingDocument));
    page.rerender(pageView());

    expect(screen.getAllByText('Processing')).not.toHaveLength(0);
    expect(screen.queryByText('Document embedding generation failed')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry processing' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete document' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled();
  });

  it('preserves Failed data and allows explicit Retry after a recoverable failure', async () => {
    const user = userEvent.setup();
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
    mockDetails(success(failedDocument));
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Retry processing' }));
    const dialog = screen.getByRole('dialog', { name: 'Retry document processing?' });
    await user.click(
      within(dialog).getByRole('button', {
        name: 'Retry processing',
      }),
    );

    expect(
      await screen.findByText('Processing could not be restarted right now. Try again.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Document embedding generation failed')).toBeInTheDocument();
    expect(screen.getAllByText('Failed')).not.toHaveLength(0);
    expect(replaceDocument).not.toHaveBeenCalled();

    await user.click(
      within(screen.getByRole('dialog', { name: 'Retry document processing?' })).getByRole(
        'button',
        { name: 'Retry processing' },
      ),
    );
    await waitFor(() => expect(documentsService.retryDocumentProcessing).toHaveBeenCalledTimes(2));
  });

  it('loads the latest Details once after an invalid-state Retry race', async () => {
    const user = userEvent.setup();
    vi.mocked(documentsService.retryDocumentProcessing).mockRejectedValue(
      new ApiClientError({
        code: 'INVALID_DOCUMENT_STATE',
        kind: 'conflict',
        message: 'The document status changed. Refresh to view its latest state.',
        status: 409,
      }),
    );
    mockDetails(success(failedDocument));
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Retry processing' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Retry document processing?' })).getByRole(
        'button',
        { name: 'Retry processing' },
      ),
    );

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(replaceDocument).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Document status changed');
    expect(
      screen.queryByRole('dialog', { name: 'Retry document processing?' }),
    ).not.toBeInTheDocument();
  });

  it('handles a not-found Retry race without disclosing ownership', async () => {
    const user = userEvent.setup();
    vi.mocked(documentsService.retryDocumentProcessing).mockRejectedValue(
      new ApiClientError({
        code: 'DOCUMENT_NOT_FOUND',
        kind: 'unexpected',
        message: 'The request could not be completed.',
        status: 404,
      }),
    );
    mockDetails(success(failedDocument));
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Retry processing' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Retry document processing?' })).getByRole(
        'button',
        { name: 'Retry processing' },
      ),
    );

    expect(
      await screen.findByRole('heading', { name: 'Documents destination' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Document unavailable');
    expect(screen.queryByText(/owner|foreign/i)).not.toBeInTheDocument();
  });

  it('prevents Retry, Delete, and Refresh mutations from overlapping', async () => {
    const user = userEvent.setup();
    const retryRequest = deferred<PublicDocumentDetails>();
    vi.mocked(documentsService.retryDocumentProcessing).mockReturnValue(retryRequest.promise);
    mockDetails(success(failedDocument));
    const page = renderPage();

    await user.click(screen.getByRole('button', { name: 'Retry processing' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Retry document processing?' })).getByRole(
        'button',
        { name: 'Retry processing' },
      ),
    );

    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete document' })).toBeDisabled();

    page.unmount();
    mockDetails(success(failedDocument, { isRefreshing: true }));
    renderPage();
    expect(screen.getByRole('button', { name: 'Retry processing' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete document' })).toBeDisabled();

    await act(async () => {
      retryRequest.resolve(processingDocument);
      await retryRequest.promise;
    });
  });

  it('disables Retry while Delete confirmation is open', async () => {
    const user = userEvent.setup();
    mockDetails(success(failedDocument));
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Delete document' }));

    expect(screen.getByRole('button', { name: 'Retry processing' })).toBeDisabled();
    expect(screen.getByRole('dialog', { name: 'Delete document?' })).toBeVisible();
    expect(
      screen.queryByRole('dialog', { name: 'Retry document processing?' }),
    ).not.toBeInTheDocument();
  });

  it.each(['ready', 'processing', 'failed'] as const)(
    'allows an authenticated owner to start deletion from the %s details state',
    async (status) => {
      const user = userEvent.setup();
      mockDetails(
        success({
          ...readyDocument,
          status,
          processingState:
            status === 'ready' ? 'READY' : status === 'failed' ? 'FAILED' : 'PROCESSING',
          processingError: status === 'failed' ? 'Safe processing issue' : null,
          processedAt: status === 'ready' ? readyDocument.processedAt : null,
        }),
      );
      renderPage();

      await user.click(screen.getByRole('button', { name: 'Delete document' }));

      expect(screen.getByRole('dialog', { name: 'Delete document?' })).toBeVisible();
      expect(documentsService.deleteDocument).not.toHaveBeenCalled();
    },
  );

  it.each(['loading', 'not-found', 'error'] as const)(
    'does not render deletion controls in the %s details state',
    (status) => {
      if (status === 'loading') {
        mockDetails({
          data: null,
          error: null,
          isRefreshing: false,
          refreshError: null,
          status,
        });
      } else if (status === 'not-found') {
        mockDetails({
          data: null,
          error: null,
          isRefreshing: false,
          refreshError: null,
          status,
        });
      } else {
        mockDetails({
          data: null,
          error: new ApiClientError({
            code: 'NETWORK_ERROR',
            kind: 'network',
            message: 'Unable to connect to the service.',
          }),
          isRefreshing: false,
          refreshError: null,
          status,
        });
      }

      renderPage();
      expect(screen.queryByRole('button', { name: 'Delete document' })).not.toBeInTheDocument();
    },
  );

  it('cancels without requesting deletion and restores the trigger', async () => {
    const user = userEvent.setup();
    renderPage();
    const trigger = screen.getByRole('button', { name: 'Delete document' });

    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog', { name: 'Delete document?' })).not.toBeInTheDocument();
    expect(documentsService.deleteDocument).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it('confirms once, navigates with success feedback, and explains asynchronous cleanup', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Delete document' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Delete document?' })).getByRole('button', {
        name: 'Delete document',
      }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Documents destination' }),
    ).toBeInTheDocument();
    expect(documentsService.deleteDocument).toHaveBeenCalledOnce();
    expect(documentsService.deleteDocument).toHaveBeenCalledWith('ready-document');
    expect(screen.getByRole('status')).toHaveTextContent('Document removed');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Final cleanup will continue in the background.',
    );
  });

  it('keeps details visible after a retryable delete failure and retries explicitly', async () => {
    const user = userEvent.setup();
    vi.mocked(documentsService.deleteDocument)
      .mockRejectedValueOnce(
        new ApiClientError({
          code: 'DOCUMENT_DELETION_QUEUE_UNAVAILABLE',
          kind: 'server',
          message: 'The document could not be deleted right now. Try again.',
          status: 503,
        }),
      )
      .mockResolvedValueOnce({
        id: 'ready-document',
        deletedAt: '2026-07-29T09:30:00.000Z',
      });
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Delete document' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Delete document?' })).getByRole('button', {
        name: 'Delete document',
      }),
    );

    expect(
      await screen.findByText('The document could not be deleted right now. Try again.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Authentication Guide.pdf' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Delete document?' })).toBeVisible();

    await user.click(
      within(screen.getByRole('dialog', { name: 'Delete document?' })).getByRole('button', {
        name: 'Delete document',
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Documents destination' }),
    ).toBeInTheDocument();
    expect(documentsService.deleteDocument).toHaveBeenCalledTimes(2);
  });

  it('handles an owner-hidden not-found deletion race without claiming deletion success', async () => {
    const user = userEvent.setup();
    vi.mocked(documentsService.deleteDocument).mockRejectedValue(
      new ApiClientError({
        code: 'DOCUMENT_NOT_FOUND',
        kind: 'unexpected',
        message: 'The request could not be completed.',
        status: 404,
      }),
    );
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Delete document' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Delete document?' })).getByRole('button', {
        name: 'Delete document',
      }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Documents destination' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Document unavailable');
    expect(screen.queryByText('Document removed')).not.toBeInTheDocument();
  });

  it('coordinates deletion with manual refresh to avoid simultaneous requests', async () => {
    const user = userEvent.setup();
    const deletion = deferred<{
      id: string;
      deletedAt: string;
    }>();
    vi.mocked(documentsService.deleteDocument).mockReturnValue(deletion.promise);
    const page = renderPage();

    await user.click(screen.getByRole('button', { name: 'Delete document' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Delete document?' })).getByRole('button', {
        name: 'Delete document',
      }),
    );
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();

    page.unmount();
    mockDetails(success(readyDocument, { isRefreshing: true }));
    renderPage();
    expect(screen.getByRole('button', { name: 'Delete document' })).toBeDisabled();

    await act(async () => {
      deletion.resolve({
        id: 'ready-document',
        deletedAt: '2026-07-29T09:30:00.000Z',
      });
      await deletion.promise;
    });
  });

  it('does not render unsupported management or document-content actions', () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Delete document' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry processing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Share/i })).not.toBeInTheDocument();
    expect(
      screen.queryByText(/PDF viewer|queue position|processing percentage/i),
    ).not.toBeInTheDocument();
  });
});
