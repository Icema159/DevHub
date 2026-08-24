import { RotateCcw } from 'lucide-react';

import { Button, Card } from '../../../components/ui';

export interface DocumentRecoveryCardProps {
  disabled: boolean;
  onRetry: () => void;
}

export function DocumentRecoveryCard({ disabled, onRetry }: DocumentRecoveryCardProps) {
  return (
    <Card className="document-details-decision-surface p-0" variant="solid">
      <section
        className="flex flex-col gap-4 p-5 sm:p-6"
        aria-labelledby="document-recovery-heading"
      >
        <div className="min-w-0">
          <h2
            id="document-recovery-heading"
            className="type-heading-3 font-semibold text-foreground"
          >
            Retry processing
          </h2>
          <p className="mt-1 type-body text-muted">Start processing this document again.</p>
        </div>

        <Button
          className="w-full shrink-0"
          disabled={disabled}
          onClick={onRetry}
          variant="secondary"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Retry processing
        </Button>
      </section>
    </Card>
  );
}
