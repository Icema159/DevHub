import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

import { cn } from '../../lib/cn';
import { Button } from './Button';
import { IconButton } from './IconButton';

export interface ModalProps {
  cancelLabel?: string;
  children: ReactNode;
  closeDisabled?: boolean;
  confirmDisabled?: boolean;
  confirmLabel?: string;
  confirmLoadingLabel?: string;
  description?: string;
  isConfirming?: boolean;
  onConfirm?: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
  variant?: 'default' | 'destructive';
}

export function Modal({
  cancelLabel = 'Cancel',
  children,
  closeDisabled = false,
  confirmDisabled = false,
  confirmLabel,
  confirmLoadingLabel = 'Working',
  description,
  isConfirming = false,
  onConfirm,
  onOpenChange,
  open,
  title,
  variant = 'default',
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[data-modal-initial-focus]')?.focus();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const closeModal = () => {
    if (!closeDisabled) {
      onOpenChange(false);
    }
  };

  const restoreFocus = () => {
    previousFocusRef.current?.focus();
    previousFocusRef.current = null;
  };

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        'material-interaction elevation-2 m-auto w-[min(34rem,calc(100%-2rem))] max-w-none rounded-glass border p-0 text-foreground',
        'backdrop:bg-slate-950/25 backdrop:backdrop-blur-[2px]',
      )}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        closeModal();
      }}
      onClose={restoreFocus}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeModal();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeModal();
        }
      }}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="type-heading-2 font-semibold text-foreground">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 type-body text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton
            autoFocus
            className="-mt-1 -mr-1"
            data-modal-initial-focus
            disabled={closeDisabled}
            label="Close dialog"
            onClick={closeModal}
          >
            <X className="size-5" aria-hidden="true" />
          </IconButton>
        </div>

        <div className="mt-5 type-body text-secondary">{children}</div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button disabled={closeDisabled} variant="secondary" onClick={closeModal}>
            {cancelLabel}
          </Button>
          {confirmLabel && onConfirm ? (
            <Button
              variant={variant === 'destructive' ? 'destructive' : 'primary'}
              disabled={confirmDisabled}
              isLoading={isConfirming}
              loadingLabel={confirmLoadingLabel}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
