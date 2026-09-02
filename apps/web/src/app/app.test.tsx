import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, type InitialEntry } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppSidebar } from '../components/layout';
import { resetAuthStore, useAuthStore } from '../features/auth';
import { ToastProvider } from '../components/ui';
import { AppRoutes } from './router';

vi.mock('../features/dashboard/use-dashboard-data', () => ({
  useDashboardData: () => ({
    documents: {
      data: {
        documents: [],
        meta: {
          page: 1,
          limit: 5,
          total: 0,
          totalPages: 0,
          statusCounts: { all: 0, ready: 0, processing: 0, failed: 0 },
        },
      },
      error: null,
      status: 'success',
    },
    conversations: {
      data: {
        conversations: [],
        meta: { page: 1, limit: 5, total: 0, totalPages: 0 },
      },
      error: null,
      status: 'success',
    },
    failedDocuments: {
      data: {
        documents: [],
        meta: {
          page: 1,
          limit: 3,
          total: 0,
          totalPages: 0,
          statusCounts: { all: 0, ready: 0, processing: 0, failed: 0 },
        },
      },
      error: null,
      status: 'success',
    },
    retryDocuments: vi.fn(),
    retryConversations: vi.fn(),
    retryFailedDocuments: vi.fn(),
  }),
}));

vi.mock('../features/documents/use-documents', () => ({
  useDocuments: () => ({
    effectiveSearch: '',
    isUploading: false,
    page: 1,
    refresh: vi.fn(),
    resource: {
      data: {
        documents: [],
        meta: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          statusCounts: { all: 0, ready: 0, processing: 0, failed: 0 },
        },
      },
      error: null,
      status: 'success',
    },
    retry: vi.fn(),
    searchInput: '',
    setPage: vi.fn(),
    setSearchInput: vi.fn(),
    setStatus: vi.fn(),
    status: 'ALL',
    upload: vi.fn(),
  }),
}));

vi.mock('../features/documents/use-document-details', () => ({
  useDocumentDetails: () => ({
    refresh: vi.fn(),
    resource: {
      data: {
        id: 'document-id',
        filename: 'Authentication Guide.pdf',
        mimeType: 'application/pdf',
        size: 1_024,
        status: 'ready',
        processingError: null,
        createdAt: '2026-07-29T08:00:00.000Z',
        updatedAt: '2026-07-29T08:05:00.000Z',
        processedAt: '2026-07-29T08:05:00.000Z',
      },
      error: null,
      isRefreshing: false,
      refreshError: null,
      status: 'success',
    },
  }),
}));

vi.mock('../features/conversations/use-conversations', () => ({
  useConversations: () => ({
    refresh: vi.fn(),
    resource: {
      data: {
        conversations: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      },
      error: null,
      isRefreshing: false,
      refreshError: null,
      status: 'success',
    },
  }),
}));

vi.mock('../features/conversations/use-create-conversation', () => ({
  useCreateConversation: () => ({
    create: vi.fn(),
    isCreating: false,
    resource: { error: null, status: 'idle' },
  }),
}));

vi.mock('../features/conversations/use-selected-conversation', () => ({
  useSelectedConversation: (conversationId: string | undefined) => ({
    refresh: vi.fn(),
    refreshAuthoritative: vi.fn(),
    resource: conversationId
      ? {
          data: {
            id: conversationId,
            title: 'Selected conversation',
            createdAt: '2026-07-29T08:00:00.000Z',
            updatedAt: '2026-07-29T08:05:00.000Z',
            messages: [],
          },
          error: null,
          status: 'success',
        }
      : {
          data: null,
          error: null,
          status: 'not-found',
        },
  }),
}));

const testUser = {
  id: 'cm123456789',
  email: 'marius@example.com',
  emailVerified: true,
  name: 'Marius Smith',
  createdAt: '2026-07-29T08:30:00.000Z',
};

function authenticateTestUser() {
  useAuthStore.setState({
    user: testUser,
    status: 'authenticated',
    operation: 'idle',
    error: null,
  });
}

function renderApp(entry: InitialEntry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetAuthStore();
});

describe('application navigation', () => {
  it('marks the current sidebar route as active', () => {
    render(
      <MemoryRouter initialEntries={['/documents']}>
        <AppSidebar user={testUser} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Documents' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Documents' })).toHaveClass('material-selected');
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });

  it('opens and closes mobile navigation', async () => {
    const user = userEvent.setup();
    authenticateTestUser();
    renderApp('/dashboard');

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).not.toBeInTheDocument();
  });

  it('closes an open mobile drawer when the desktop breakpoint starts', async () => {
    const originalMatchMedia = window.matchMedia;
    const user = userEvent.setup();
    let desktopMatches = false;
    let changeListener: ((event: MediaQueryListEvent) => void) | undefined;
    const desktopMediaQuery = {
      get matches() {
        return desktopMatches;
      },
      media: '(min-width: 1024px)',
      onchange: null,
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        changeListener = listener as (event: MediaQueryListEvent) => void;
      },
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    } as MediaQueryList;

    window.matchMedia = vi.fn(() => desktopMediaQuery);

    try {
      authenticateTestUser();
      renderApp('/dashboard');
      await user.click(screen.getByRole('button', { name: 'Open navigation' }));
      expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeVisible();

      act(() => {
        desktopMatches = true;
        changeListener?.({ matches: true } as MediaQueryListEvent);
      });

      expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).not.toBeInTheDocument();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it.each([
    ['/dashboard', 'Overview'],
    ['/documents', 'Documents'],
    ['/documents/document-id', 'Authentication Guide.pdf'],
    ['/chat', 'Threads'],
    ['/chat/conversation-id', 'Threads'],
  ])('renders the %s route without crashing', (path, heading) => {
    authenticateTestUser();
    renderApp(path);

    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it('keeps the decorative ambient layer scoped to the approved Overview, Threads, and Documents workspaces', () => {
    authenticateTestUser();
    const { container, unmount } = renderApp('/dashboard');
    const dashboardAmbientLayer = container.querySelector('.ambient-light-layer');

    expect(dashboardAmbientLayer).toHaveAttribute('aria-hidden', 'true');
    expect(dashboardAmbientLayer?.querySelectorAll('.ambient-light-field')).toHaveLength(3);

    unmount();
    const chatRender = renderApp('/chat/conversation-id');
    const ambientLayer = chatRender.container.querySelector('.ambient-light-layer');

    expect(ambientLayer).toHaveAttribute('aria-hidden', 'true');
    expect(ambientLayer?.querySelectorAll('.ambient-light-field')).toHaveLength(3);

    chatRender.unmount();
    const documentsRender = renderApp('/documents');
    const documentsAmbientLayer = documentsRender.container.querySelector('.ambient-light-layer');

    expect(documentsRender.container.querySelector('.documents-identity')).toBeInTheDocument();
    expect(documentsAmbientLayer).toHaveAttribute('aria-hidden', 'true');
    expect(documentsAmbientLayer?.querySelectorAll('.ambient-light-field')).toHaveLength(3);

    documentsRender.unmount();
    const documentDetailsRender = renderApp('/documents/document-id');

    const documentDetailsAmbientLayer =
      documentDetailsRender.container.querySelector('.ambient-light-layer');

    expect(
      documentDetailsRender.container.querySelector('.documents-identity'),
    ).toBeInTheDocument();
    expect(documentDetailsAmbientLayer).toHaveAttribute('aria-hidden', 'true');
    expect(documentDetailsAmbientLayer?.querySelectorAll('.ambient-light-field')).toHaveLength(3);
  });

  it('applies the approved Dark V4 identity to the production Threads route', () => {
    authenticateTestUser();
    const threadsRender = renderApp('/chat/conversation-id');
    const threadsCanvas = threadsRender.container.querySelector('.app-canvas');

    expect(threadsCanvas).toHaveClass('chat-identity', 'chat-dark-v4-identity');
    expect(threadsCanvas?.querySelectorAll('.ambient-light-field')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Threads' })).toHaveAttribute('href', '/chat');
  });

  it('removes the legacy Dark V4 experiment route after production rollout', () => {
    authenticateTestUser();
    renderApp('/experiments/chat-dark-v4/conversation-id');

    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Threads' })).not.toBeInTheDocument();
  });

  it('renders the Design System preview route', () => {
    renderApp('/ui-kit');

    expect(screen.getByRole('heading', { level: 1, name: 'Design System' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Status badges' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Material hierarchy' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Elevation' })).toBeInTheDocument();
    expect(screen.getAllByText('Authentication Guide.pdf')).not.toHaveLength(0);
    expect(screen.getByRole('article', { name: 'User message' })).toHaveTextContent(
      'How does JWT authentication work?',
    );
    expect(screen.getByRole('article', { name: 'Assistant message' })).toBeInTheDocument();
  });

  it('exposes the Design System preview route only outside production builds', () => {
    vi.stubEnv('DEV', false);

    try {
      useAuthStore.setState({ status: 'unauthenticated' });
      renderApp('/ui-kit');

      expect(
        screen.queryByRole('heading', { level: 1, name: 'Design System' }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('redirects an unauthenticated visitor away from protected routes', () => {
    useAuthStore.setState({ status: 'unauthenticated' });
    renderApp('/documents');

    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Documents' })).not.toBeInTheDocument();
  });

  it('protects a direct document-details route with the existing auth guard', () => {
    useAuthStore.setState({ status: 'unauthenticated' });
    renderApp('/documents/document-id');

    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 1, name: 'Authentication Guide.pdf' }),
    ).not.toBeInTheDocument();
  });

  it('protects a direct conversation route with the existing auth guard', () => {
    useAuthStore.setState({ status: 'unauthenticated' });
    renderApp('/chat/conversation-id');

    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Threads' })).not.toBeInTheDocument();
  });

  it('redirects an authenticated visitor away from public auth routes', () => {
    authenticateTestUser();
    renderApp('/login');

    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
  });

  it('does not render protected content while authentication is checking', () => {
    useAuthStore.setState({ status: 'checking' });
    renderApp('/dashboard');

    expect(screen.getByRole('status')).toHaveTextContent('Checking your session');
    expect(
      screen.queryByRole('heading', { level: 1, name: 'Welcome back, Marius' }),
    ).not.toBeInTheDocument();
  });

  it('restores the intended protected destination after login', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      status: 'unauthenticated',
      login: async () => {
        authenticateTestUser();
      },
    });
    renderApp({ pathname: '/login', state: { from: '/documents' } });

    await user.type(screen.getByLabelText(/Email address/), testUser.email);
    await user.type(screen.getByLabelText(/Password/), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Documents' })).toBeInTheDocument();
    });
  });

  it('provides logout from the authenticated App Shell', async () => {
    const user = userEvent.setup();
    const logout = vi.fn(async () => {
      useAuthStore.setState({ user: null, status: 'unauthenticated' });
    });
    authenticateTestUser();
    useAuthStore.setState({ logout });
    renderApp('/dashboard');

    await user.click(screen.getByRole('button', { name: 'Log out' }));

    expect(logout).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
  });
});
