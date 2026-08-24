import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../../lib/api-client';
import { resetAuthStore, useAuthStore } from '../auth';
import type {
  DashboardConversationList,
  DashboardDocumentList,
  DashboardResource,
} from './dashboard.types';
import { useDashboardData } from './use-dashboard-data';
import { DashboardPage } from './pages/DashboardPage';

vi.mock('./use-dashboard-data', () => ({
  useDashboardData: vi.fn(),
}));

const documents: DashboardDocumentList = {
  documents: [
    {
      id: 'ready-document',
      filename: 'Authentication Guide.pdf',
      mimeType: 'application/pdf',
      size: 1_887_436,
      status: 'ready',
      createdAt: '2026-07-28T08:00:00.000Z',
      updatedAt: '2026-07-28T08:05:00.000Z',
      processedAt: '2026-07-28T08:05:00.000Z',
    },
    {
      id: 'processing-document',
      filename: 'System Architecture.pdf',
      mimeType: 'application/pdf',
      size: 2_000_000,
      status: 'processing',
      createdAt: '2026-07-27T08:00:00.000Z',
      updatedAt: '2026-07-27T08:05:00.000Z',
      processedAt: null,
    },
  ],
  meta: {
    page: 1,
    limit: 5,
    total: 2,
    totalPages: 1,
    statusCounts: { all: 4, ready: 2, processing: 1, failed: 1 },
  },
};

const failedDocuments: DashboardDocumentList = {
  documents: [
    {
      id: 'failed-document',
      filename: 'Broken Reference.pdf',
      mimeType: 'application/pdf',
      size: 900_000,
      status: 'failed',
      createdAt: '2026-07-26T08:00:00.000Z',
      updatedAt: '2026-07-26T08:05:00.000Z',
      processedAt: null,
    },
  ],
  meta: {
    page: 1,
    limit: 3,
    total: 1,
    totalPages: 1,
    statusCounts: { all: 4, ready: 2, processing: 1, failed: 1 },
  },
};

const conversations: DashboardConversationList = {
  conversations: [
    {
      id: 'conversation-one',
      title: 'JWT Authentication',
      preview: 'How does JWT authentication work?',
      createdAt: '2026-07-28T09:00:00.000Z',
      updatedAt: '2026-07-28T09:05:00.000Z',
    },
    {
      id: 'conversation-two',
      title: null,
      preview: null,
      createdAt: '2026-07-27T09:00:00.000Z',
      updatedAt: '2026-07-27T09:05:00.000Z',
    },
  ],
  meta: { page: 1, limit: 5, total: 2, totalPages: 1 },
};

function success<T>(data: T): DashboardResource<T> {
  return { data, error: null, status: 'success' };
}

const retryDocuments = vi.fn(async () => undefined);
const retryConversations = vi.fn(async () => undefined);
const retryFailedDocuments = vi.fn(async () => undefined);

function mockDashboardData(overrides: Partial<ReturnType<typeof useDashboardData>> = {}) {
  vi.mocked(useDashboardData).mockReturnValue({
    documents: success(documents),
    conversations: success(conversations),
    failedDocuments: success(failedDocuments),
    retryDocuments,
    retryConversations,
    retryFailedDocuments,
    ...overrides,
  });
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/documents" element={<h1>Documents destination</h1>} />
        <Route path="/chat" element={<h1>Chat destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetAuthStore();
  vi.clearAllMocks();
  useAuthStore.setState({
    user: {
      id: 'user-id',
      email: 'marius@example.com',
      emailVerified: true,
      name: 'Marius Smith',
      createdAt: '2026-07-29T08:00:00.000Z',
    },
    status: 'authenticated',
  });
  mockDashboardData();
});

describe('Dashboard page', () => {
  it('renders personalized real counts, documents, conversations, and attention data', () => {
    renderDashboard();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back, Marius');
    expect(screen.getByText('Documents').previousElementSibling).toHaveTextContent('4');
    expect(screen.getByText('Authentication Guide.pdf')).toBeInTheDocument();
    expect(screen.getByText('JWT Authentication')).toBeInTheDocument();
    expect(screen.getByText('Broken Reference.pdf')).toBeInTheDocument();
    expect(screen.getByText('New conversation')).toBeInTheDocument();
    expect(screen.queryByText(/^You:$/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /JWT Authentication/ })).toHaveAttribute(
      'href',
      '/chat/conversation-one',
    );
  });

  it('falls back to a non-personalized welcome for a nullable name', () => {
    useAuthStore.setState({
      user: {
        id: 'user-id',
        email: 'developer@example.com',
        emailVerified: true,
        name: null,
        createdAt: '2026-07-29T08:00:00.000Z',
      },
    });

    renderDashboard();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back');
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent(',');
  });

  it('renders stable new-user onboarding and empty states', () => {
    const emptyDocuments: DashboardDocumentList = {
      documents: [],
      meta: {
        page: 1,
        limit: 5,
        total: 0,
        totalPages: 0,
        statusCounts: { all: 0, ready: 0, processing: 0, failed: 0 },
      },
    };
    const emptyConversations: DashboardConversationList = {
      conversations: [],
      meta: { page: 1, limit: 5, total: 0, totalPages: 0 },
    };

    mockDashboardData({
      documents: success(emptyDocuments),
      conversations: success(emptyConversations),
      failedDocuments: success({ ...emptyDocuments, meta: { ...emptyDocuments.meta, limit: 3 } }),
    });
    renderDashboard();

    expect(screen.getByText('Build your knowledge base')).toBeInTheDocument();
    expect(screen.getByText('No documents yet')).toBeInTheDocument();
    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    expect(screen.getByText('All documents are on track')).toBeInTheDocument();
  });

  it('renders skeletons while independent data is loading', () => {
    const loading = { data: null, error: null, status: 'loading' } as const;
    mockDashboardData({
      documents: loading,
      conversations: loading,
      failedDocuments: loading,
    });
    renderDashboard();

    expect(screen.getByRole('status', { name: 'Loading document overview' })).toBeInTheDocument();
    expect(screen.getAllByRole('status', { name: 'Loading list' })).toHaveLength(3);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('keeps successful conversations visible when document data fails', async () => {
    const user = userEvent.setup();
    const error = new ApiClientError({
      code: 'NETWORK_ERROR',
      kind: 'network',
      message: 'Unable to connect to the service.',
    });
    mockDashboardData({
      documents: { data: null, error, status: 'error' },
    });
    renderDashboard();

    expect(screen.getByText('JWT Authentication')).toBeInTheDocument();
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole('button', { name: 'Retry' })[0]!);
    expect(retryDocuments).toHaveBeenCalledOnce();
    expect(retryConversations).not.toHaveBeenCalled();
  });

  it('keeps successful document data visible when conversations fail', () => {
    const error = new ApiClientError({
      code: 'HTTP_500',
      kind: 'server',
      message: 'The service is temporarily unavailable.',
      status: 500,
    });
    mockDashboardData({
      conversations: { data: null, error, status: 'error' },
    });
    renderDashboard();

    expect(screen.getByText('Authentication Guide.pdf')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('The service is temporarily unavailable.');
  });

  it('navigates from Upload document to the document library', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole('link', { name: /Upload document/ }));
    expect(screen.getByRole('heading', { name: 'Documents destination' })).toBeInTheDocument();
  });

  it('navigates from New chat to chat without creating a conversation', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole('link', { name: /New chat/ }));
    expect(screen.getByRole('heading', { name: 'Chat destination' })).toBeInTheDocument();
  });

  it('does not render unsupported Dashboard concepts', () => {
    renderDashboard();

    expect(screen.queryByText(/Activity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Free plan/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/processing percentage/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry processing/i })).not.toBeInTheDocument();
  });
});
