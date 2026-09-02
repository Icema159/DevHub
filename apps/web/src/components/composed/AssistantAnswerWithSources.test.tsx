import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatMessage } from './ChatMessage';

const citations = [
  {
    documentId: 'document-one',
    filename: 'Authentication Guide.pdf',
    page: 12,
    sourceLabel: '[S1]',
  },
  {
    documentId: 'document-two',
    filename: '<script>architecture</script>.pdf',
    sourceLabel: '[S2]',
  },
];

function renderAnswer(content: string, sources = citations) {
  return render(
    <MemoryRouter>
      <ChatMessage citations={sources} content={content} enableCitationInteraction role="assistant">
        <time dateTime="2026-08-29T08:00:00.000Z">Aug 29, 2026</time>
      </ChatMessage>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Assistant answer source interaction', () => {
  it('makes only known strict message-local labels interactive', () => {
    renderAnswer('Known [S1], repeated [S1], unknown [S9], malformed [S01] and <script>.');

    expect(screen.getAllByRole('button', { name: 'Show source S1' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Show source S9' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Assistant message')).toHaveTextContent(
      'unknown [S9], malformed [S01] and <script>',
    );
    expect(document.querySelector('script')).not.toBeInTheDocument();
  });

  it('keeps the focused answer presentation free of an assistant avatar', () => {
    const { container } = renderAnswer('A focused answer [S1].');

    expect(container.querySelector('.chat-message-assistant-avatar')).not.toBeInTheDocument();
  });

  it('links pointer and keyboard state within the current message', async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    renderAnswer('Use the documented flow [S1].');

    const marker = screen.getByRole('button', { name: 'Show source S1' });
    const source = screen.getByRole('link', {
      name: 'Source [S1]: Authentication Guide.pdf, page 12',
    });

    await user.hover(source);
    expect(marker).toHaveClass('is-active');

    await user.unhover(source);
    expect(marker).not.toHaveClass('is-active');

    await user.click(marker);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
    expect(source).toHaveFocus();
    expect(source).toHaveAttribute('data-active', 'true');
  });

  it('uses instant source scrolling when reduced motion is requested', async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }));
    renderAnswer('Reduced motion source [S1].');

    await user.click(screen.getByRole('button', { name: 'Show source S1' }));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'nearest' });
  });

  it('keeps answers inert when the message has no sources', () => {
    renderAnswer('No evidence for [S1] or <strong>markup</strong>.', []);

    expect(screen.queryByRole('button', { name: /Show source/ })).not.toBeInTheDocument();
    expect(screen.getByText(/No evidence for \[S1\]/)).toBeInTheDocument();
    expect(document.querySelector('strong')).not.toBeInTheDocument();
  });

  it('preserves nullable pages and document navigation', () => {
    renderAnswer('Two sources [S1] [S2].');

    expect(
      screen.getByRole('link', { name: 'Source [S2]: <script>architecture</script>.pdf' }),
    ).toHaveAttribute('href', '/documents/document-two');
    expect(screen.queryByText('Page undefined')).not.toBeInTheDocument();
  });
});
