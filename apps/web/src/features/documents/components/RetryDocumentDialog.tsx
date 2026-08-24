import { Alert, Modal } from '../../../components/ui';
import type { ApiClientError } from '../../../lib/api-client';

export interface RetryDocumentDialogProps {
  error: ApiClientError | null;
  filename: string;
  isRetrying: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
}

export function RetryDocumentDialog({
  error,
  filename,
  isRetrying,
  onCancel,
  onConfirm,
  open,
}: RetryDocumentDialogProps) {
  return (
    <Modal
      closeDisabled={isRetrying}
      confirmDisabled={isRetrying}
      confirmLabel="Retry processing"
      confirmLoadingLabel="Retrying…"
      description="Review this processing restart before continuing."
      isConfirming={isRetrying}
      onConfirm={onConfirm}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onCancel();
        }
      }}
      open={open}
      title="Retry document processing?"
    >
      <div className="grid gap-4">
        <p>
          This will restart processing for{' '}
          <strong className="break-words font-semibold text-foreground [overflow-wrap:anywhere]">
            “{filename}”
          </strong>
          .
        </p>

        <Alert title="What happens next">
          The previous failed processing data will be reset, and the document will return to
          Processing.
        </Alert>

        {error ? (
          <Alert title="Unable to restart processing" variant="error">
            {error.message}
          </Alert>
        ) : null}
      </div>
    </Modal>
  );
}
