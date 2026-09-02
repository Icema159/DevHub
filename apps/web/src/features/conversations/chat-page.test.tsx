import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../../lib/api-client';
import * as conversationsService from './conversations.service';
import type {
  ConversationListResult,
  PublicConversation,
  PublicConversationDetail,
} from './conversations.types';
import { ChatPage } from './pages/ChatPage';

vi.mock('./conversations.service', async (importOriginal) => {
  const original = await importOriginal<typeof import('./conversations.service')>();

  return {
    ...original,
    createConversation: vi.fn(),
    getConversation: vi.fn(),
    listConversations: vi.fn(),
    streamConversationMessage: vi.fn(),
  };
});

const conversationSummaries: ConversationListResult = {
  conversations: [
    {
      id: 'jwt-conversation',
      title: 'JWT Authentication',
      preview: 'How does JWT authentication work?',
      createdAt: '2026-07-29T08:00:00.000Z',
      updatedAt: '2026-07-29T10:00:00.000Z',
    },
    {
      id: 'new-conversation',
      title: null,
      preview: null,
      createdAt: '2026-07-29T07:00:00.000Z',
      updatedAt: '2026-07-29T09:00:00.000Z',
    },
  ],
  meta: { page: 1, limit: 20, total: 22, totalPages: 2 },
};

const selectedConversation: PublicConversationDetail = {
  id: 'jwt-conversation',
  title: 'JWT Authentication',
  createdAt: '2026-07-29T08:00:00.000Z',
  updatedAt: '2026-07-29T10:00:00.000Z',
  messages: [
    {
      id: 'message-id',
      role: 'USER',
      content: 'Existing persisted message.',
      createdAt: '2026-07-29T08:01:00.000Z',
      sources: [],
    },
  ],
};

const createdConversation: PublicConversation = {
  id: 'created-conversation',
  title: null,
  createdAt: '2026-07-29T11:00:00.000Z',
  updatedAt: '2026-07-29T11:00:00.000Z',
};

const completedTurn = {
  message: {
    id: 'assistant-message-id',
    role: 'ASSISTANT' as const,
    content: 'Use an HttpOnly cookie.',
    createdAt: '2026-07-29T10:02:00.000Z',
  },
  sources: [],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current location">{`${location.pathname}${location.search}`}</output>;
}

function renderChat(path = '/chat') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/chat"
          element={
            <>
              <ChatPage />
              <LocationProbe />
            </>
          }
        />
        <Route
          path="/chat/:conversationId"
          element={
            <>
              <ChatPage />
              <LocationProbe />
            </>
          }
        />
        <Route
          path="/documents/*"
          element={
            <>
              <p>Document details destination</p>
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(conversationsService.listConversations).mockResolvedValue(conversationSummaries);
  vi.mocked(conversationsService.getConversation).mockImplementation(async (conversationId) => ({
    ...selectedConversation,
    id: conversationId,
    title: conversationId === 'new-conversation' ? null : selectedConversation.title,
  }));
  vi.mocked(conversationsService.createConversation).mockResolvedValue(createdConversation);
  vi.mocked(conversationsService.streamConversationMessage).mockResolvedValue(completedTurn);
});

describe('Threads page', () => {
  it('replaces the placeholder with the real workspace without creating automatically', async () => {
    renderChat();

    expect(screen.getByRole('heading', { level: 1, name: 'Threads' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Threads' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Thread workspace' })).toHaveClass(
      'material-workspace',
    );
    expect(screen.queryByText('Page shell is ready')).not.toBeInTheDocument();
    expect(conversationsService.createConversation).not.toHaveBeenCalled();

    await screen.findByRole('link', { name: /JWT Authentication/ });
    expect(conversationsService.listConversations).toHaveBeenCalledWith(
      { page: 1, limit: 20 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('preserves backend order and renders stable nullable fallbacks', async () => {
    renderChat();
    const navigation = await screen.findByRole('navigation', { name: 'Threads' });
    const links = within(navigation).getAllByRole('link');

    expect(links[0]).toHaveTextContent('JWT Authentication');
    expect(links[1]).toHaveTextContent('New thread');
    expect(links[1]).toHaveTextContent('No messages yet');
  });

  it('navigates a semantic list link, marks it current, and loads selected metadata', async () => {
    const user = userEvent.setup();
    renderChat();

    await user.click(await screen.findByRole('link', { name: /JWT Authentication/ }));

    await screen.findByRole('heading', { level: 2, name: 'JWT Authentication' });
    await waitFor(() =>
      expect(screen.getByLabelText('Current location')).toHaveTextContent(
        '/chat/jwt-conversation?page=1',
      ),
    );
    expect(screen.getByRole('link', { name: /JWT Authentication/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: /JWT Authentication/ })).toHaveClass(
      'material-selected',
    );
    expect(screen.getByRole('link', { name: 'Back to threads' })).toHaveClass('xl:hidden');
    expect(conversationsService.getConversation).toHaveBeenCalledWith(
      'jwt-conversation',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('keeps list, create, and back navigation inside the production Threads route', async () => {
    const user = userEvent.setup();
    renderChat();

    expect(screen.getByRole('region', { name: 'Threads' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Thread workspace' })).toBeInTheDocument();
    expect(screen.queryByText('Conversations')).not.toBeInTheDocument();
    expect(screen.queryByText('Your recent knowledge conversations.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Enter to send/)).not.toBeInTheDocument();

    const conversationLink = await screen.findByRole('link', { name: /JWT Authentication/ });
    expect(conversationLink).toHaveAttribute('href', '/chat/jwt-conversation?page=1');

    await user.click(conversationLink);
    await waitFor(() =>
      expect(screen.getByLabelText('Current location')).toHaveTextContent(
        '/chat/jwt-conversation?page=1',
      ),
    );
    expect(screen.getByRole('link', { name: 'Back to threads' })).toHaveAttribute(
      'href',
      '/chat?page=1',
    );

    await user.click(screen.getByRole('button', { name: 'New thread' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Current location')).toHaveTextContent(
        '/chat/created-conversation?page=1',
      ),
    );
  });

  it('omits the one-page thread count while preserving meaningful pagination behavior', async () => {
    vi.mocked(conversationsService.listConversations).mockResolvedValue({
      ...conversationSummaries,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });

    renderChat();

    await screen.findByRole('navigation', { name: 'Threads' });
    expect(screen.queryByText('2 conversations')).not.toBeInTheDocument();
    expect(screen.queryByText('2 threads')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('connects inline citation markers to their source receipts', async () => {
    vi.mocked(conversationsService.getConversation).mockResolvedValue({
      ...selectedConversation,
      messages: [
        {
          id: 'assistant-with-source',
          role: 'ASSISTANT',
          content: 'Use the documented cookie flow [S1].',
          createdAt: '2026-07-29T08:02:00.000Z',
          sources: [
            {
              label: 'S1',
              documentId: 'authentication-guide',
              documentName: 'Authentication Guide.pdf',
              chunkId: 'authentication-chunk',
              chunkPosition: 1,
              page: 12,
            },
          ],
        },
      ],
    });

    renderChat('/chat/jwt-conversation');
    expect(await screen.findByText(/documented cookie flow/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show source S1' })).toHaveClass(
      'chat-inline-citation',
    );
    const source = screen.getByRole('link', {
      name: 'Source [S1]: Authentication Guide.pdf, page 12',
    });
    expect(source).toHaveClass('chat-citation-receipt');
    expect(source).toHaveAttribute('href', '/documents/authentication-guide');
  });

  it('loads a direct-linked conversation even when it is absent from the current list page', async () => {
    renderChat('/chat/direct-conversation?page=2');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'JWT Authentication' }),
    ).toBeInTheDocument();
    expect(conversationsService.getConversation).toHaveBeenCalledWith(
      'direct-conversation',
      expect.any(Object),
    );
    expect(screen.queryByRole('link', { name: /direct-conversation/i })).not.toBeInTheDocument();
  });

  it('renders the real thread and composer without citation or unsupported controls', async () => {
    renderChat('/chat/jwt-conversation');

    expect(await screen.findByText('Existing persisted message.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument();
    expect(screen.queryByText(/sources used|citation/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/model selector|rename|delete conversation|attach|regenerate/i),
    ).not.toBeInTheDocument();
  });

  it('shows an empty thread with a real composer and no fake greeting', async () => {
    vi.mocked(conversationsService.getConversation).mockResolvedValue({
      ...selectedConversation,
      id: 'new-conversation',
      title: null,
      messages: [],
    });
    renderChat('/chat/new-conversation');

    expect(await screen.findByText('Start the conversation')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.queryByText(/hello|how can i help/i)).not.toBeInTheDocument();
  });

  it('sends one new question, reloads authoritative messages, and refreshes page one', async () => {
    const user = userEvent.setup();
    vi.mocked(conversationsService.streamConversationMessage).mockResolvedValueOnce({
      ...completedTurn,
      sources: [
        {
          label: 'S1',
          documentId: 'post-only-document',
          documentName: 'POST-only Source.pdf',
          chunkId: 'post-only-chunk',
          chunkPosition: 1,
          page: 3,
        },
      ],
    });
    const refreshedConversation: PublicConversationDetail = {
      ...selectedConversation,
      title: 'Secure JWT Storage',
      updatedAt: '2026-07-29T10:02:00.000Z',
      messages: [
        ...selectedConversation.messages,
        {
          id: 'server-user-message-id',
          role: 'USER',
          content: 'Where should I store it?',
          createdAt: '2026-07-29T10:01:00.000Z',
          sources: [],
        },
        {
          ...completedTurn.message,
          sources: [
            {
              label: 'S1',
              documentId: 'persisted/document',
              documentName: 'Persisted Source.pdf',
              chunkId: 'persisted-chunk',
              chunkPosition: 7,
              page: 12,
            },
          ],
        },
      ],
    };
    vi.mocked(conversationsService.getConversation)
      .mockResolvedValueOnce(selectedConversation)
      .mockResolvedValueOnce(refreshedConversation);
    renderChat('/chat/jwt-conversation?page=2');
    const textarea = await screen.findByRole('textbox', { name: 'Message' });

    await user.type(textarea, 'Where should I store it?{Enter}');

    await waitFor(() =>
      expect(conversationsService.streamConversationMessage).toHaveBeenCalledWith(
        'jwt-conversation',
        'Where should I store it?',
        expect.objectContaining({ signal: expect.any(AbortSignal), onEvent: expect.any(Function) }),
      ),
    );
    expect(await screen.findByText('Use an HttpOnly cookie.')).toBeInTheDocument();
    expect(screen.getByText('Where should I store it?')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Source [S1]: Persisted Source.pdf, page 12' }),
    ).toHaveAttribute('href', '/documents/persisted%2Fdocument');
    expect(screen.queryByText('POST-only Source.pdf')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Secure JWT Storage' }),
    ).toBeInTheDocument();
    expect(textarea).toHaveValue('');
    await waitFor(() =>
      expect(screen.getByLabelText('Current location')).toHaveTextContent(
        '/chat/jwt-conversation?page=1',
      ),
    );
    await waitFor(() =>
      expect(conversationsService.listConversations).toHaveBeenLastCalledWith(
        { page: 1, limit: 20 },
        expect.any(Object),
      ),
    );
  });

  it('keeps the draft and shows no fake ASSISTANT message after a compensated AI failure', async () => {
    const user = userEvent.setup();
    vi.mocked(conversationsService.streamConversationMessage).mockRejectedValue(
      new ApiClientError({
        code: 'AI_PROVIDER_UNAVAILABLE',
        kind: 'server',
        message: 'The service is temporarily unavailable. Try again later.',
        status: 503,
      }),
    );
    vi.mocked(conversationsService.getConversation)
      .mockResolvedValueOnce(selectedConversation)
      .mockResolvedValueOnce(selectedConversation);
    renderChat('/chat/jwt-conversation');
    const textarea = await screen.findByRole('textbox', { name: 'Message' });

    await user.type(textarea, 'Question that should be retried');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An answer could not be created right now. Try again.',
    );
    expect(textarea).toHaveValue('Question that should be retried');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(conversationsService.streamConversationMessage).toHaveBeenCalledOnce();
  });

  it('creates exactly once, preserves the server ID, navigates, and refreshes page one', async () => {
    const user = userEvent.setup();
    const createRequest = deferred<PublicConversation>();
    vi.mocked(conversationsService.createConversation).mockReturnValue(createRequest.promise);
    vi.mocked(conversationsService.getConversation).mockResolvedValue({
      ...selectedConversation,
      ...createdConversation,
      messages: [],
    });
    renderChat('/chat?page=2');
    await screen.findByRole('region', { name: 'Threads' });

    const createButton = screen.getByRole('button', { name: 'New thread' });
    await user.dblClick(createButton);

    expect(conversationsService.createConversation).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
    createRequest.resolve(createdConversation);
    await waitFor(() =>
      expect(screen.getByLabelText('Current location')).toHaveTextContent(
        '/chat/created-conversation?page=1',
      ),
    );
    expect(
      await screen.findByRole('heading', { level: 2, name: 'New thread' }),
    ).toBeInTheDocument();
    expect(conversationsService.listConversations).toHaveBeenLastCalledWith(
      { page: 1, limit: 20 },
      expect.any(Object),
    );
  });

  it('keeps the current route and list after create failure and permits an explicit retry', async () => {
    const user = userEvent.setup();
    vi.mocked(conversationsService.createConversation)
      .mockRejectedValueOnce(
        new ApiClientError({
          code: 'NETWORK_ERROR',
          kind: 'network',
          message: 'Unable to connect to the service.',
        }),
      )
      .mockResolvedValueOnce(createdConversation);
    renderChat('/chat/jwt-conversation');
    await screen.findByRole('heading', { level: 2, name: 'JWT Authentication' });

    await user.click(screen.getByRole('button', { name: 'New thread' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Thread could not be created');
    expect(screen.getByLabelText('Current location')).toHaveTextContent('/chat/jwt-conversation');
    expect(screen.getByRole('link', { name: /JWT Authentication/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New thread' }));
    await waitFor(() => expect(conversationsService.createConversation).toHaveBeenCalledTimes(2));
  });

  it('uses one generic unavailable state for owner-hidden not-found responses', async () => {
    vi.mocked(conversationsService.getConversation).mockRejectedValue(
      new ApiClientError({
        code: 'CONVERSATION_NOT_FOUND',
        kind: 'unexpected',
        message: 'The request could not be completed.',
        status: 404,
      }),
    );
    renderChat('/chat/foreign-conversation');

    expect(
      await screen.findByText('This thread could not be found or is no longer available.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/owner|forbidden|another user/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to threads' })).toHaveAttribute(
      'href',
      '/chat?page=1',
    );
  });

  it('keeps network failure distinct from not-found and retries explicitly', async () => {
    const user = userEvent.setup();
    vi.mocked(conversationsService.getConversation)
      .mockRejectedValueOnce(
        new ApiClientError({
          code: 'NETWORK_ERROR',
          kind: 'network',
          message: 'Unable to connect to the service.',
        }),
      )
      .mockResolvedValueOnce(selectedConversation);
    renderChat('/chat/jwt-conversation');

    expect(await screen.findByRole('alert')).toHaveTextContent('Thread could not be loaded');
    expect(screen.queryByText('Thread unavailable')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'JWT Authentication' }),
    ).toBeInTheDocument();
  });

  it('renders untrusted title and preview as escaped plain text', async () => {
    const unsafeTitle = '<script>alert("title")</script>';
    const unsafePreview = '<img src=x onerror=alert("preview")>';
    vi.mocked(conversationsService.listConversations).mockResolvedValue({
      conversations: [
        {
          ...conversationSummaries.conversations[0]!,
          title: unsafeTitle,
          preview: unsafePreview,
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const { container } = renderChat();

    expect(await screen.findByText(unsafeTitle)).toBeInTheDocument();
    expect(screen.getByText(unsafePreview)).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders loading, empty, and list-error states with real actions', async () => {
    const pending = new Promise<ConversationListResult>(() => undefined);
    vi.mocked(conversationsService.listConversations).mockReturnValueOnce(pending);
    const loadingPage = renderChat();
    expect(screen.getByRole('status', { name: 'Loading conversations' })).toBeInTheDocument();
    loadingPage.unmount();

    vi.mocked(conversationsService.listConversations).mockResolvedValueOnce({
      conversations: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    const emptyPage = renderChat();
    expect(await screen.findByText('No threads yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'New thread' })).toHaveLength(1);
    emptyPage.unmount();

    vi.mocked(conversationsService.listConversations).mockRejectedValueOnce(
      new ApiClientError({
        code: 'NETWORK_ERROR',
        kind: 'network',
        message: 'Unable to connect to the service.',
      }),
    );
    renderChat();
    expect(await screen.findByRole('alert')).toHaveTextContent('Threads could not be loaded');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
  });

  it('uses real backend pagination without client-side reordering', async () => {
    const user = userEvent.setup();
    vi.mocked(conversationsService.listConversations).mockImplementation(async (params = {}) =>
      params.page === 2
        ? {
            conversations: [
              {
                id: 'page-two-conversation',
                title: 'Page two result',
                preview: 'Backend ordered',
                createdAt: '2026-07-28T08:00:00.000Z',
                updatedAt: '2026-07-28T09:00:00.000Z',
              },
            ],
            meta: { page: 2, limit: 20, total: 22, totalPages: 2 },
          }
        : conversationSummaries,
    );
    renderChat('/chat?page=1');
    await screen.findByRole('link', { name: /JWT Authentication/ });

    await user.click(screen.getByRole('button', { name: 'Go to next page' }));

    expect(await screen.findByRole('link', { name: /Page two result/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Current location')).toHaveTextContent('/chat?page=2');
    expect(conversationsService.listConversations).toHaveBeenLastCalledWith(
      { page: 2, limit: 20 },
      expect.any(Object),
    );
  });
});
