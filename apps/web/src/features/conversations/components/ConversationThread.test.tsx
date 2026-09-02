import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { DocumentNotFoundState } from '../../documents/components';
import type { PublicConversationMessage } from '../conversations.types';
import { ConversationThread } from './ConversationThread';

const messages: PublicConversationMessage[] = [
  {
    id: 'user-internal-id',
    role: 'USER',
    content: '<script>alert("unsafe")</script>\nAntroji eilutė 🚀',
    createdAt: '2026-07-29T08:01:00.000Z',
    sources: [],
  },
  {
    id: 'assistant-internal-id',
    role: 'ASSISTANT',
    content: 'Grounded answer\nwith a verylongwordwithoutbreakpoints',
    createdAt: '2026-07-29T08:02:00.000Z',
    sources: [
      {
        label: 'S1',
        documentId: 'private-document-id',
        documentName: 'Private Source.pdf',
        chunkId: 'private-chunk-id',
        chunkPosition: 2,
        page: 4,
      },
    ],
  },
];

function LocationProbe() {
  const location = useLocation();

  return <output aria-label="Current location">{location.pathname}</output>;
}

function renderThread(threadMessages: PublicConversationMessage[] = messages) {
  return render(
    <MemoryRouter initialEntries={['/chat/conversation-id']}>
      <Routes>
        <Route
          path="/chat/:conversationId"
          element={<ConversationThread isSubmitting={false} messages={threadMessages} />}
        />
        <Route
          path="/documents/*"
          element={
            <>
              <DocumentNotFoundState />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ConversationThread', () => {
  it('renders USER and ASSISTANT messages in backend order with accessible roles', () => {
    renderThread();

    const list = screen.getByRole('list', { name: 'Messages' });
    const articles = within(list).getAllByRole('article');

    expect(articles).toHaveLength(2);
    expect(articles[0]).toHaveAccessibleName('User message');
    expect(articles[0]).toHaveTextContent('<script>alert("unsafe")</script> Antroji eilutė 🚀');
    expect(articles[1]).toHaveAccessibleName('Assistant message');
    expect(articles[1]).toHaveTextContent('Grounded answer with a verylongwordwithoutbreakpoints');
  });

  it('renders HTML-like and multiline content as plain selectable text', () => {
    const { container } = renderThread();
    const unsafeText = screen.getByText(/<script>alert/);

    expect(unsafeText).toHaveClass('whitespace-pre-wrap');
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('renders a validated ASSISTANT source as one semantic encoded Document Details link', async () => {
    const user = userEvent.setup();
    renderThread([
      {
        ...messages[1]!,
        sources: [
          {
            label: 'S1',
            documentId: 'document/id?owner=other',
            documentName: 'Authentication Guide.pdf',
            chunkId: 'internal-chunk-id',
            chunkPosition: 4,
            page: 12,
          },
        ],
      },
    ]);

    const link = screen.getByRole('link', {
      name: 'Source [S1]: Authentication Guide.pdf, page 12',
    });

    expect(link).toHaveAttribute('href', '/documents/document%2Fid%3Fowner%3Dother');
    expect(link).toHaveTextContent('[S1]');
    expect(link).toHaveTextContent('Authentication Guide.pdf');
    expect(link).toHaveTextContent('Page 12');
    expect(within(link).queryByRole('button')).not.toBeInTheDocument();
    expect(link.querySelector('a')).toBeNull();
    expect(link).not.toHaveTextContent('internal-chunk-id');
    expect(link).not.toHaveTextContent('4');

    await user.click(link);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Document not found' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Current location')).toHaveTextContent(
      '/documents/document%2Fid%3Fowner%3Dother',
    );
  });

  it('preserves source order and does not deduplicate sources from the same document', () => {
    renderThread([
      {
        ...messages[1]!,
        sources: [
          {
            label: 'S2',
            documentId: 'shared-document',
            documentName: 'Shared.pdf',
            chunkId: 'chunk-second',
            chunkPosition: 8,
            page: 8,
          },
          {
            label: 'S1',
            documentId: 'shared-document',
            documentName: 'Shared.pdf',
            chunkId: 'chunk-first',
            chunkPosition: 2,
            page: 2,
          },
        ],
      },
    ]);

    const links = screen.getAllByRole('link');

    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent('[S2]');
    expect(links[0]).toHaveTextContent('Shared.pdf');
    expect(links[0]).toHaveTextContent('Page 8');
    expect(links[1]).toHaveTextContent('[S1]');
    expect(links[1]).toHaveTextContent('Shared.pdf');
    expect(links[1]).toHaveTextContent('Page 2');
  });

  it('keeps a source with page null and omits only its page text', () => {
    renderThread([
      {
        ...messages[1]!,
        sources: [{ ...messages[1]!.sources[0]!, page: null }],
      },
    ]);

    expect(
      screen.getByRole('link', { name: 'Source [S1]: Private Source.pdf' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Page \d+/)).not.toBeInTheDocument();
  });

  it('renders long and HTML-like document names as inert wrapping text', () => {
    const unsafeFilename = `<img src=x onerror=alert('source')>${'verylongfilename'.repeat(10)}.pdf`;
    const { container } = renderThread([
      {
        ...messages[1]!,
        sources: [{ ...messages[1]!.sources[0]!, documentName: unsafeFilename }],
      },
    ]);

    const filename = screen.getByText(unsafeFilename);

    expect(filename).toHaveClass('break-words');
    expect(container.querySelector('img')).toBeNull();
  });

  it('formats confirmed source labels once and does not expose internal source fields', () => {
    renderThread();

    expect(screen.getByText('Private Source.pdf')).toBeInTheDocument();
    expect(screen.getByText('[S1]')).toBeInTheDocument();
    expect(screen.queryByText('[[S1]]')).not.toBeInTheDocument();
    expect(screen.queryByText('private-document-id')).not.toBeInTheDocument();
    expect(screen.queryByText('private-chunk-id')).not.toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('never renders source cards for a USER message even at the lower presentation boundary', () => {
    const malformedUserMessage = {
      ...messages[0]!,
      sources: [messages[1]!.sources[0]!],
    } as unknown as PublicConversationMessage;

    renderThread([malformedUserMessage]);

    expect(screen.getByRole('article', { name: 'User message' })).toBeInTheDocument();
    expect(screen.queryByText('Sources used')).not.toBeInTheDocument();
    expect(screen.queryByText('Private Source.pdf')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('does not expose internal message IDs as content', () => {
    renderThread();

    expect(screen.queryByText('user-internal-id')).not.toBeInTheDocument();
    expect(screen.queryByText('assistant-internal-id')).not.toBeInTheDocument();
  });

  it('shows a neutral empty thread without inventing an assistant greeting', () => {
    renderThread([]);

    expect(screen.getByText('Start the conversation')).toBeInTheDocument();
    expect(
      screen.getByText('Ask a question about the knowledge available in your workspace.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('shows a transient turn immediately and keeps streamed citation markers inert', () => {
    render(
      <MemoryRouter>
        <ConversationThread
          enableCitationInteraction
          isSubmitting
          messages={[]}
          pendingContent="How does auth work?"
          streamedAnswer="It uses a cookie [S1]"
          streamingPhase="generating"
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('pending-user-message')).toHaveTextContent('How does auth work?');
    expect(screen.getByTestId('streaming-assistant-message')).toHaveTextContent(
      'It uses a cookie [S1]',
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /source/i })).not.toBeInTheDocument();
  });

  it('shows retrieval feedback before the first model delta', () => {
    render(
      <MemoryRouter>
        <ConversationThread
          isSubmitting
          messages={[]}
          pendingContent="Question"
          streamedAnswer=""
          streamingPhase="retrieving"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Retrieving relevant sources…');
  });

  it('renders deterministic insufficient context as a normal ASSISTANT message', () => {
    renderThread([
      {
        id: 'assistant-id',
        role: 'ASSISTANT',
        content:
          'The available documents do not contain enough information to answer this question.',
        createdAt: '2026-07-29T08:02:00.000Z',
        sources: [],
      },
    ]);

    expect(screen.getByRole('article', { name: 'Assistant message' })).toHaveTextContent(
      'The available documents do not contain enough information to answer this question.',
    );
    expect(screen.queryByText('Sources used')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
