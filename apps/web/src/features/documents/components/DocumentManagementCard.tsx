import { Trash2 } from 'lucide-react';

import { Button, Card } from '../../../components/ui';

export interface DocumentManagementCardProps {
  disabled: boolean;
  onDelete: () => void;
}

export function DocumentManagementCard({ disabled, onDelete }: DocumentManagementCardProps) {
  return (
    <Card className="document-details-remove-surface p-0" variant="solid">
      <section
        className="flex flex-col gap-4 p-5 sm:p-6"
        aria-labelledby="document-management-heading"
      >
        <div className="min-w-0">
          <h2
            id="document-management-heading"
            className="type-heading-3 font-semibold text-foreground"
          >
            Remove
          </h2>
          <p className="mt-1 type-body text-muted">
            Removing this document deletes it and its processed data from your knowledge base. It
            will no longer be used to answer new questions.
          </p>
        </div>

        <Button
          className="document-details-remove-button w-full shrink-0"
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
