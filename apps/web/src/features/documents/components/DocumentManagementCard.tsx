import { Trash2 } from 'lucide-react';

import { Button, Card } from '../../../components/ui';

export interface DocumentManagementCardProps {
  disabled: boolean;
  onDelete: () => void;
}

export function DocumentManagementCard({ disabled, onDelete }: DocumentManagementCardProps) {
  return (
    <Card className="document-details-decision-surface p-0" variant="solid">
      <section
        className="flex flex-col gap-4 p-5 sm:p-6"
        aria-labelledby="document-management-heading"
      >
        <div className="min-w-0">
          <h2
            id="document-management-heading"
            className="type-heading-3 font-semibold text-foreground"
          >
            Document management
          </h2>
          <p className="mt-1 type-body text-muted">
            Remove this document from your knowledge base.
          </p>
        </div>

        <Button
          className="w-full shrink-0"
          disabled={disabled}
          onClick={onDelete}
          variant="destructive"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Delete document
        </Button>
      </section>
    </Card>
  );
}
