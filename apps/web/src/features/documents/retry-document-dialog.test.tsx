import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../../lib/api-client';
import { RetryDocumentDialog } from './components/RetryDocumentDialog';

const defaultProps = {
  error: null,
  filename: 'Authentication Guide.pdf',
  isRetrying: false,
  onCancel: vi.fn(),
  onConfirm: vi.fn(),
  open: true,
};

describe('RetryDocumentDialog', () => {
  it('explains the server-confirmed restart and renders a long filename as plain text', () => {
    const unsafeFilename =
      '<img src=x onerror="alert(1)"> Very long authentication reference document.pdf';
    const { container } = render(
      <RetryDocumentDialog {...defaultProps} filename={unsafeFilename} />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Retry document processing?' });
    expect(dialog).toBeVisible();
    expect(dialog).toHaveAccessibleDescription('Review this processing restart before continuing.');
    expect(screen.getByText(`“${unsafeFilename}”`)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText(/previous failed processing data will be reset/)).toBeInTheDocument();
  });

  it('cancels with the button or Escape without confirming', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <RetryDocumentDialog {...defaultProps} onCancel={onCancel} onConfirm={onConfirm} />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();

    onCancel.mockClear();
    rerender(<RetryDocumentDialog {...defaultProps} onCancel={onCancel} onConfirm={onConfirm} />);
    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms through a non-destructive action', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<RetryDocumentDialog {...defaultProps} onConfirm={onConfirm} />);

    const confirm = screen.getByRole('button', { name: 'Retry processing' });
    expect(confirm).not.toHaveClass('bg-danger');
    await user.click(confirm);

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('announces active Retry and blocks dismissal or duplicate interaction', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <RetryDocumentDialog
        {...defaultProps}
        isRetrying
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Retrying…' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeDisabled();

    await user.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('keeps safe retryable feedback inside the dialog', () => {
    render(
      <RetryDocumentDialog
        {...defaultProps}
        error={
          new ApiClientError({
            code: 'PROCESSING_QUEUE_UNAVAILABLE',
            kind: 'server',
            message: 'Processing could not be restarted right now. Try again.',
            status: 503,
          })
        }
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Processing could not be restarted right now. Try again.',
    );
    expect(screen.getByRole('button', { name: 'Retry processing' })).toBeEnabled();
  });
});
