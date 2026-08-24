import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '../../components/ui';
import { ApiClientError } from '../../lib/api-client';
import type { DocumentList, DocumentListResource, PublicDocument } from './documents.types';
import { useDocuments } from './use-documents';
import { DocumentsPage } from './pages/DocumentsPage';
import { MAX_UPLOAD_SIZE_BYTES } from './components/UploadDocumentModal';

vi.mock('./use-documents', () => ({
  useDocuments: vi.fn(),
}));

const documents: DocumentList = {
  documents: [
    {
      id: 'ready-document',
      filename: 'Authentication Guide.pdf',
      mimeType: 'application/pdf',
      size: 1_887_436,
      status: 'ready',
      createdAt: '2026-07-29T08:00:00.000Z',
      updatedAt: '2026-07-29T08:05:00.000Z',
      processedAt: '2026-07-29T08:05:00.000Z',
    },
    {
      id: 'processing-document',
      filename: 'System Architecture.pdf',
      mimeType: 'application/pdf',
      size: 2_400_000,
      status: 'processing',
      createdAt: '2026-07-28T08:00:00.000Z',
      updatedAt: '2026-07-28T08:05:00.000Z',
      processedAt: null,
    },
    {
      id: 'failed-document',
      filename: 'Broken Reference.pdf',
      mimeType: 'application/pdf',
      size: 842_000,
      status: 'failed',
      createdAt: '2026-07-27T08:00:00.000Z',
      updatedAt: '2026-07-27T08:05:00.000Z',
      processedAt: null,
    },
  ],
  meta: {
    page: 1,
    limit: 20,
    total: 23,
    totalPages: 2,
    statusCounts: { all: 23, ready: 18, processing: 4, failed: 1 },
  },
};

const uploadedDocument: PublicDocument = {
  id: 'uploaded-document',
  filename: 'Selected Guide.pdf',
  mimeType: 'application/pdf',
  size: 1_024,
  status: 'processing',
  createdAt: '2026-07-29T09:00:00.000Z',
  updatedAt: '2026-07-29T09:00:00.000Z',
  processedAt: null,
};

const setSearchInput = vi.fn();
const setStatus = vi.fn();
const setPage = vi.fn();
const refresh = vi.fn();
const retry = vi.fn();
const upload = vi.fn(async () => uploadedDocument);

function success(data: DocumentList): DocumentListResource {
  return { data, error: null, status: 'success' };
}

function mockDocuments(overrides: Partial<ReturnType<typeof useDocuments>> = {}) {
  vi.mocked(useDocuments).mockReturnValue({
    effectiveSearch: '',
    isUploading: false,
    page: 1,
    refresh,
    resource: success(documents),
    retry,
    searchInput: '',
    setPage,
    setSearchInput,
    setStatus,
    status: 'ALL',
    upload,
    ...overrides,
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider duration={60_000}>
        <DocumentsPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDocuments();
});

describe('Documents page', () => {
  it('renders real document data, status counts, safe statuses, sizes, and pagination', () => {
    const { container } = renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Documents' })).toBeInTheDocument();
    expect(screen.queryByText('Knowledge library')).not.toBeInTheDocument();
    expect(screen.getByText('Authentication Guide.pdf')).toBeInTheDocument();
    expect(screen.getAllByText('1.8 MB')).not.toHaveLength(0);
    expect(container.querySelector('[data-status="ready"]')).toHaveTextContent('Ready');
    expect(container.querySelector('[data-status="processing"]')).toHaveTextContent('Processing');
    expect(container.querySelector('[data-status="failed"]')).toHaveTextContent('Failed');
    expect(screen.getByRole('button', { name: /All/ })).toHaveTextContent('23');
    expect(screen.getByText('Showing 1–3 of 23 documents')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open document Authentication Guide.pdf' }),
    ).toHaveAttribute('href', '/documents/ready-document');
  });

  it('renders long HTML-looking filenames as inert text with a complete accessible link name', () => {
    const filename =
      'API Reference <script>alert(1)</script> — extremely long distributed systems edition.pdf';
    mockDocuments({
      resource: success({
        documents: [{ ...documents.documents[0]!, id: 'unsafe-looking-name', filename }],
        meta: {
          ...documents.meta,
          total: 1,
          totalPages: 1,
          statusCounts: { all: 1, ready: 1, processing: 0, failed: 0 },
        },
      }),
    });

    const { container } = renderPage();

    expect(screen.getByText(filename)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: `Open document ${filename}` })).toHaveAttribute(
      'href',
      '/documents/unsafe-looking-name',
    );
    expect(container.querySelector('script')).not.toBeInTheDocument();
  });

  it('renders list and count skeletons before data resolves', () => {
    mockDocuments({
      resource: { data: null, error: null, status: 'loading' },
    });
    renderPage();

    expect(screen.getByRole('status', { name: 'Loading documents' })).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('keeps a list failure scoped and provides a retry action', async () => {
    const user = userEvent.setup();
    mockDocuments({
      resource: {
        data: null,
        error: new ApiClientError({
          code: 'NETWORK_ERROR',
          kind: 'network',
          message: 'Unable to connect to the service.',
        }),
        status: 'error',
      },
    });
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Documents' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to connect to the service.');

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('renders the new-user empty state and opens upload from its CTA', async () => {
    const user = userEvent.setup();
    mockDocuments({
      resource: success({
        documents: [],
        meta: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          statusCounts: { all: 0, ready: 0, processing: 0, failed: 0 },
        },
      }),
    });
    renderPage();

    expect(screen.getByText('No documents yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Upload your first document' }));
    expect(screen.getByRole('dialog', { name: 'Upload document' })).toBeVisible();
  });

  it('renders distinct search and status-filter empty states', () => {
    const emptyData: DocumentList = {
      documents: [],
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        statusCounts: { all: 0, ready: 0, processing: 0, failed: 0 },
      },
    };
    mockDocuments({
      effectiveSearch: 'JWT',
      searchInput: 'JWT',
      resource: success(emptyData),
    });
    const { rerender } = renderPage();

    expect(screen.getByText('No documents found')).toBeInTheDocument();

    mockDocuments({
      resource: success(emptyData),
      status: 'FAILED',
    });
    rerender(
      <MemoryRouter>
        <ToastProvider duration={60_000}>
          <DocumentsPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('No failed documents')).toBeInTheDocument();
  });

  it('forwards search, filter, refresh, and pagination controls to the hook', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Search documents'), 'JWT');
    expect(setSearchInput).toHaveBeenLastCalledWith('T');

    await user.click(screen.getByRole('button', { name: /Failed/ }));
    expect(setStatus).toHaveBeenCalledWith('FAILED');

    await user.click(screen.getByRole('button', { name: 'Refresh documents' }));
    expect(refresh).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(setPage).toHaveBeenCalledWith(2);
  });

  it('opens and closes the accessible upload modal and restores trigger focus', async () => {
    const user = userEvent.setup();
    renderPage();

    const trigger = screen.getByRole('button', { name: 'Upload document' });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Upload document' })).toBeVisible();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Upload document' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it.each([
    [new File(['text'], 'notes.txt', { type: 'text/plain' }), 'Only PDF files are supported.'],
    [new File([], 'empty.pdf', { type: 'application/pdf' }), 'The selected PDF is empty.'],
    [
      new File([new Uint8Array(MAX_UPLOAD_SIZE_BYTES + 1)], 'large.pdf', {
        type: 'application/pdf',
      }),
      'This file is too large. The maximum size is 10 MB.',
    ],
  ])('rejects invalid selected files with a friendly error', async (file, message) => {
    const user = userEvent.setup({ applyAccept: false });
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Upload document' }));
    await user.upload(screen.getByLabelText('Choose PDF'), file);

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
  });

  it('shows selected file details and allows removal', async () => {
    const user = userEvent.setup();
    renderPage();
    const file = new File(['%PDF-test'], 'Selected Guide.pdf', {
      type: 'application/pdf',
    });

    await user.click(screen.getByRole('button', { name: 'Upload document' }));
    await user.upload(screen.getByLabelText('Choose PDF'), file);

    expect(screen.getByText('Selected Guide.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Remove selected file' }));
    expect(screen.queryByText('Selected Guide.pdf')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
  });

  it('accepts one valid PDF through drag and drop', async () => {
    const user = userEvent.setup();
    renderPage();
    const file = new File(['%PDF-test'], 'Dropped Guide.pdf', {
      type: 'application/pdf',
    });

    await user.click(screen.getByRole('button', { name: 'Upload document' }));
    const dropzone = screen.getByText('Drop a PDF here or choose a file').parentElement;

    expect(dropzone).not.toBeNull();
    fireEvent.dragEnter(dropzone!, { dataTransfer: { files: [file] } });
    fireEvent.drop(dropzone!, { dataTransfer: { files: [file] } });

    expect(screen.getByText('Dropped Guide.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeEnabled();
  });

  it('closes after a successful upload and shows safe success feedback', async () => {
    const user = userEvent.setup();
    renderPage();
    const file = new File(['%PDF-test'], 'Selected Guide.pdf', {
      type: 'application/pdf',
    });

    await user.click(screen.getByRole('button', { name: 'Upload document' }));
    await user.upload(screen.getByLabelText('Choose PDF'), file);
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Upload document' })).not.toBeInTheDocument();
    });
    expect(upload).toHaveBeenCalledWith(file);
    expect(screen.getByRole('status')).toHaveTextContent('Document uploaded');
    expect(screen.getByRole('status')).toHaveTextContent('Processing has started');
  });

  it('keeps the modal open and shows a friendly duplicate error', async () => {
    const user = userEvent.setup();
    upload.mockRejectedValueOnce(
      new ApiClientError({
        code: 'DUPLICATE_DOCUMENT',
        kind: 'conflict',
        message: 'This document already exists in your knowledge base.',
        status: 409,
      }),
    );
    renderPage();
    const file = new File(['%PDF-test'], 'Duplicate.pdf', { type: 'application/pdf' });

    await user.click(screen.getByRole('button', { name: 'Upload document' }));
    await user.upload(screen.getByLabelText('Choose PDF'), file);
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This document already exists in your knowledge base.',
    );
    expect(screen.getByRole('dialog', { name: 'Upload document' })).toBeVisible();
  });

  it('does not render unsupported document actions', () => {
    renderPage();

    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry processing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Share/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/processing percentage/i)).not.toBeInTheDocument();
  });
});
