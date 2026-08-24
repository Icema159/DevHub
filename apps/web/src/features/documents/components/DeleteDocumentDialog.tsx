import { Alert, Modal } from '../../../components/ui';
import type { ApiClientError } from '../../../lib/api-client';

export interface DeleteDocumentDialogProps {
  error: ApiClientError | null;
  filename: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
}

export function DeleteDocumentDialog({
  error,
  filename,
  isDeleting,
  onCancel,
  onConfirm,
  open,
}: DeleteDocumentDialogProps) {
  return (
    <Modal
      closeDisabled={isDeleting}
      confirmDisabled={isDeleting}
      confirmLabel="Delete document"
      confirmLoadingLabel="Deleting…"
      description="Review this irreversible action before continuing."
      isConfirming={isDeleting}
      onConfirm={onConfirm}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onCancel();
        }
      }}
      open={open}
      title="Delete document?"
      variant="destructive"
    >
      <div className="grid gap-4">
        <p>
          This will remove{' '}
          <strong className="break-words font-semibold text-foreground [overflow-wrap:anywhere]">
            “{filename}”
          </strong>{' '}
          from your knowledge base. The document will no longer be available for search or AI
          answers.
        </p>

        <Alert title="Cleanup continues in the background">
          Final cleanup of the stored file and processed data may continue after the document is
          removed.
        </Alert>

        {error ? (
          <Alert title="Unable to delete document" variant="error">
            {error.message}
          </Alert>
        ) : null}
      </div>
    </Modal>
  );
}
