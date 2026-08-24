import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../../lib/api-client';
import { DeleteDocumentDialog } from './components/DeleteDocumentDialog';

const defaultProps = {
  error: null,
  filename: 'Authentication Guide.pdf',
  isDeleting: false,
  onCancel: vi.fn(),
  onConfirm: vi.fn(),
  open: true,
};

describe('DeleteDocumentDialog', () => {
  it('explains the irreversible asynchronous deletion and renders the filename as plain text', () => {
    const unsafeFilename = '<img src=x onerror="alert(1)"> Very long document name.pdf';
    const { container } = render(
      <DeleteDocumentDialog {...defaultProps} filename={unsafeFilename} />,
    );

    expect(screen.getByRole('dialog', { name: 'Delete document?' })).toBeVisible();
    expect(screen.getByText(`“${unsafeFilename}”`)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText(/no longer be available for search or AI answers/)).toBeInTheDocument();
    expect(screen.getByText(/Final cleanup.*may continue/)).toBeInTheDocument();
  });

  it('cancels with the button or Escape without confirming', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <DeleteDocumentDialog {...defaultProps} onCancel={onCancel} onConfirm={onConfirm} />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();

    onCancel.mockClear();
    rerender(<DeleteDocumentDialog {...defaultProps} onCancel={onCancel} onConfirm={onConfirm} />);
    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms once from the destructive action', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DeleteDocumentDialog {...defaultProps} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Delete document' }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('blocks dismissal and duplicate confirmation while deletion is active', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <DeleteDocumentDialog
        {...defaultProps}
        isDeleting
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeDisabled();

    await user.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('keeps safe retryable feedback inside the dialog', () => {
    render(
      <DeleteDocumentDialog
        {...defaultProps}
        error={
          new ApiClientError({
            code: 'DOCUMENT_DELETION_QUEUE_UNAVAILABLE',
            kind: 'server',
            message: 'The document could not be deleted right now. Try again.',
            status: 503,
          })
        }
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The document could not be deleted right now. Try again.',
    );
    expect(screen.getByRole('button', { name: 'Delete document' })).toBeEnabled();
  });
});
