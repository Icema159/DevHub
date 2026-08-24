import { FileSearch, Files, LoaderCircle, TriangleAlert } from 'lucide-react';

import { Button, EmptyState } from '../../../components/ui';
import type { DocumentStatusFilter } from '../documents.types';

export interface DocumentsEmptyStateProps {
  onClearSearch: () => void;
  onUpload: () => void;
  search: string;
  status: DocumentStatusFilter;
}

const statusContent: Record<
  Exclude<DocumentStatusFilter, 'ALL'>,
  { description: string; icon: typeof FileSearch; title: string }
> = {
  READY: {
    title: 'No ready documents',
    description: 'No documents are ready for AI search yet.',
    icon: Files,
  },
  PROCESSING: {
    title: 'No processing documents',
    description: 'No documents are currently processing.',
    icon: LoaderCircle,
  },
  FAILED: {
    title: 'No failed documents',
    description: 'No documents have failed processing.',
    icon: TriangleAlert,
  },
};

export function DocumentsEmptyState({
  onClearSearch,
  onUpload,
  search,
  status,
}: DocumentsEmptyStateProps) {
  if (search) {
    return (
      <EmptyState
        className="min-h-64 rounded-none border-0 bg-transparent py-12"
        description="Try a different filename or clear your search."
        icon={<FileSearch className="size-6" aria-hidden="true" />}
        primaryAction={
          <Button variant="secondary" onClick={onClearSearch}>
            Clear search
          </Button>
        }
        title="No documents found"
      />
    );
  }

  if (status !== 'ALL') {
    const content = statusContent[status];
    const Icon = content.icon;

    return (
      <EmptyState
        className="min-h-64 rounded-none border-0 bg-transparent py-12"
        description={content.description}
        icon={<Icon className="size-6" aria-hidden="true" />}
        title={content.title}
      />
    );
  }

  return (
    <EmptyState
      className="min-h-72 rounded-none border-0 bg-transparent py-14"
      description="Upload your first PDF to start building a searchable knowledge base."
      icon={<Files className="size-6" aria-hidden="true" />}
      primaryAction={<Button onClick={onUpload}>Upload your first document</Button>}
      title="No documents yet"
    />
  );
}
