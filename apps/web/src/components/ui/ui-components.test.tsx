import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilePlus2 } from 'lucide-react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Input } from './Input';
import { Modal } from './Modal';
import { Pagination } from './Pagination';
import { StatusBadge } from './StatusBadge';

describe('Button', () => {
  it('renders every visual variant', () => {
    render(
      <>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Primary' })).toHaveClass('bg-primary');
    expect(screen.getByRole('button', { name: 'Primary' })).toHaveClass('text-on-primary');
    expect(screen.getByRole('button', { name: 'Secondary' })).toHaveClass('bg-white/90');
    expect(screen.getByRole('button', { name: 'Ghost' })).toHaveClass('bg-transparent');
    expect(screen.getByRole('button', { name: 'Destructive' })).toHaveClass('bg-danger');
    expect(screen.getByRole('button', { name: 'Destructive' })).toHaveClass('text-on-danger');
  });

  it('keeps typography sizing independent from semantic foreground color', () => {
    render(
      <>
        <Button className="type-heading-3">Primary action</Button>
        <Button className="type-heading-3" variant="destructive">
          Destructive action
        </Button>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Primary action' })).toHaveClass(
      'type-heading-3',
      'text-on-primary',
    );
    expect(screen.getByRole('button', { name: 'Destructive action' })).toHaveClass(
      'type-heading-3',
      'text-on-danger',
    );
  });

  it('prevents interaction while disabled', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('exposes an accessible loading state and blocks interaction', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button isLoading loadingLabel="Saving" onClick={onClick}>
        Save changes
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Saving' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('StatusBadge', () => {
  it.each([
    ['ready', 'Ready', 'text-status-ready-foreground', 'bg-status-ready-background'],
    [
      'processing',
      'Processing',
      'text-status-processing-foreground',
      'bg-status-processing-background',
    ],
    ['failed', 'Failed', 'text-status-failed-foreground', 'bg-status-failed-background'],
  ] as const)(
    'renders the %s semantic treatment with a label and icon',
    (status, label, foregroundClass, backgroundClass) => {
      const { container } = render(<StatusBadge status={status} />);

      expect(screen.getByText(label)).toBeInTheDocument();
      expect(container.querySelector('svg')).toBeInTheDocument();
      expect(screen.getByText(label)).toHaveClass(foregroundClass, backgroundClass);
    },
  );
});

describe('Input', () => {
  it('associates its label and error message with the input', () => {
    render(<Input label="Email address" error="Enter a valid email." />);

    const input = screen.getByLabelText('Email address');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a valid email.');
  });
});

describe('Modal', () => {
  function ModalHarness() {
    const [open, setOpen] = useState(false);

    return (
      <>
        <Button onClick={() => setOpen(true)}>Open confirmation</Button>
        <Modal open={open} title="Confirm action" onOpenChange={setOpen}>
          Modal content
        </Modal>
      </>
    );
  }

  it('opens, closes with Escape, and restores focus', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    const trigger = screen.getByRole('button', { name: 'Open confirmation' });
    await user.click(trigger);

    expect(screen.getByRole('dialog', { name: 'Confirm action' })).toBeVisible();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Confirm action' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes from its close control', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    await user.click(screen.getByRole('button', { name: 'Open confirmation' }));
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));

    expect(screen.queryByRole('dialog', { name: 'Confirm action' })).not.toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders an optional action', () => {
    render(
      <EmptyState
        icon={<FilePlus2 aria-hidden="true" />}
        title="No documents"
        description="Upload your first document."
        primaryAction={<Button>Upload document</Button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Upload document' })).toBeInTheDocument();
  });
});

describe('Pagination', () => {
  it('disables previous and next controls at their boundaries', () => {
    const onPageChange = vi.fn();
    const { rerender } = render(
      <Pagination currentPage={1} totalPages={3} onPageChange={onPageChange} />,
    );

    expect(screen.getByRole('button', { name: 'Go to previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go to next page' })).toBeEnabled();

    rerender(<Pagination currentPage={3} totalPages={3} onPageChange={onPageChange} />);

    expect(screen.getByRole('button', { name: 'Go to previous page' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Go to next page' })).toBeDisabled();
  });

  it('requests the adjacent page', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={2} totalPages={3} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
