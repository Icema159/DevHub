import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../../../lib/api-client';
import { MAX_CONVERSATION_MESSAGE_LENGTH } from '../conversations.service';
import type { MessageSubmissionResource } from '../use-conversation-messaging';
import { MessageComposer } from './MessageComposer';

const idleResource: MessageSubmissionResource = { error: null, status: 'idle' };

describe('MessageComposer', () => {
  it('keeps the compact pill limited to the textbox and send action without idle helper copy', () => {
    const { container } = render(
      <MessageComposer
        compact
        disabled={false}
        isSubmitting={false}
        onSubmit={vi.fn()}
        resource={idleResource}
      />,
    );

    const pill = container.querySelector('.chat-composer-pill');
    expect(pill).toContainElement(screen.getByRole('textbox', { name: 'Message' }));
    expect(pill).toContainElement(screen.getByRole('button', { name: 'Send message' }));
    expect(container.querySelector('.chat-composer-helper')).not.toBeInTheDocument();
    expect(screen.queryByText(/Enter to send/)).not.toBeInTheDocument();
  });

  it('provides an accessible multiline textbox and Send button without unsupported controls', () => {
    render(
      <MessageComposer
        disabled={false}
        isSubmitting={false}
        onSubmit={vi.fn()}
        resource={idleResource}
      />,
    );

    expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(
      screen
        .getByRole('textbox', { name: 'Message' })
        .closest('form')
        ?.querySelector('.material-interaction'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /attach|voice|model|markdown/i })).toBeNull();
  });

  it('submits valid content with Enter and clears only after confirmed success', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ clearDraft: true, status: 'success' });
    render(
      <MessageComposer
        disabled={false}
        isSubmitting={false}
        onSubmit={onSubmit}
        resource={idleResource}
      />,
    );
    const textarea = screen.getByRole('textbox', { name: 'Message' });

    await user.type(textarea, 'Where should I store it?{Enter}');

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Where should I store it?'));
    await waitFor(() => expect(textarea).toHaveValue(''));
    expect(textarea).toHaveFocus();
  });

  it('uses Shift + Enter for a newline without submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <MessageComposer
        disabled={false}
        isSubmitting={false}
        onSubmit={onSubmit}
        resource={idleResource}
      />,
    );
    const textarea = screen.getByRole('textbox', { name: 'Message' });

    await user.type(textarea, 'First line{Shift>}{Enter}{/Shift}Second line');

    expect(textarea).toHaveValue('First line\nSecond line');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not submit Enter during IME composition', () => {
    const onSubmit = vi.fn();
    render(
      <MessageComposer
        disabled={false}
        isSubmitting={false}
        onSubmit={onSubmit}
        resource={idleResource}
      />,
    );
    const textarea = screen.getByRole('textbox', { name: 'Message' });

    fireEvent.change(textarea, { target: { value: '入力中' } });
    fireEvent.compositionStart(textarea);
    fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true });
    fireEvent.compositionEnd(textarea);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('入力中');
  });

  it('rejects whitespace-only and over-limit content while preserving the draft', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <MessageComposer
        disabled={false}
        isSubmitting={false}
        onSubmit={onSubmit}
        resource={idleResource}
      />,
    );
    const textarea = screen.getByRole('textbox', { name: 'Message' });

    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(await screen.findByText('Enter a message before sending.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(
      <MessageComposer
        disabled={false}
        isSubmitting={false}
        onSubmit={onSubmit}
        resource={idleResource}
      />,
    );
    const overLimit = 'x'.repeat(MAX_CONVERSATION_MESSAGE_LENGTH + 1);
    fireEvent.change(textarea, { target: { value: overLimit } });
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText(/must not exceed 4,000 characters/i)).toBeInTheDocument();
    expect(textarea).toHaveValue(overLimit);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps a draft after definite failure and exposes safe associated feedback', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ clearDraft: false, status: 'error' });
    const errorResource: MessageSubmissionResource = {
      error: new ApiClientError({
        code: 'AI_PROVIDER_UNAVAILABLE',
        kind: 'server',
        message: 'Private provider details must not render.',
        status: 503,
      }),
      questionPersisted: false,
      status: 'error',
    };
    render(
      <MessageComposer
        disabled={false}
        isSubmitting={false}
        onSubmit={onSubmit}
        resource={errorResource}
      />,
    );
    const textarea = screen.getByRole('textbox', { name: 'Message' });

    await user.type(textarea, 'Retry this question');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(textarea).toHaveValue('Retry this question');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'An answer could not be created right now. Try again.',
    );
    expect(screen.queryByText(/Private provider details/)).not.toBeInTheDocument();
  });

  it('shows a non-token pending state and prevents editing while submitting', () => {
    render(
      <MessageComposer
        disabled={false}
        isSubmitting
        onSubmit={vi.fn()}
        resource={{
          error: null,
          pendingContent: 'Question',
          phase: 'generating',
          status: 'submitting',
          streamedAnswer: 'Partial answer',
        }}
      />,
    );

    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(screen.getByText('Generating answer…')).toHaveAttribute('role', 'status');
    expect(screen.queryByText(/token|typing|%/i)).not.toBeInTheDocument();
  });
});
