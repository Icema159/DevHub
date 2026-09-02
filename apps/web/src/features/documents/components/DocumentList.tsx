import { RefreshCw } from 'lucide-react';

import { Alert, Button, Pagination, Skeleton } from '../../../components/ui';
import type { DocumentListResource, DocumentStatusFilter } from '../documents.types';
import { DocumentListItem } from './DocumentListItem';
import { DocumentsEmptyState } from './DocumentsEmptyState';

export interface DocumentListProps {
  effectiveSearch: string;
  onClearSearch: () => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onUpload: () => void;
  resource: DocumentListResource;
  status: DocumentStatusFilter;
}

export function DocumentList({
  effectiveSearch,
  onClearSearch,
  onPageChange,
  onRetry,
  onUpload,
  resource,
  status,
}: DocumentListProps) {
  if (resource.status === 'loading') {
    return (
      <section
        className="material-knowledge documents-library-surface overflow-hidden rounded-none border-0"
        aria-label="Loading documents"
        role="status"
      >
        <span className="sr-only">Loading documents</span>
        <div className="documents-v4-table-header hidden grid-cols-[3.5rem_minmax(14rem,1fr)_7rem_10rem_7rem] gap-3 border-b border-border px-5 py-3 type-caption font-semibold uppercase tracking-[0.08em] text-muted xl:grid">
          <span aria-hidden="true">№</span>
          <span>Document</span>
          <span>Size</span>
          <span>Uploaded</span>
          <span>Status</span>
        </div>
        <div className="divide-y divide-border/75 px-4 sm:px-5">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="grid min-h-16 grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3 py-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_7rem] xl:grid-cols-[3.5rem_minmax(14rem,1fr)_7rem_10rem_7rem]"
            >
              <Skeleton className="size-10 rounded-control" />
              <div className="min-w-0">
                <Skeleton className="h-4 max-w-sm" />
                <Skeleton className="mt-2 h-3 max-w-36 xl:hidden" />
              </div>
              <Skeleton className="hidden h-4 w-16 xl:block" />
              <Skeleton className="hidden h-4 w-24 xl:block" />
              <Skeleton className="hidden h-7 w-20 rounded-full sm:block" />
            </div>
          ))}
        </div>
        <footer className="flex min-h-18 flex-col items-center justify-between gap-4 border-t border-border bg-slate-50/45 px-4 py-4 sm:flex-row sm:px-5">
          <Skeleton className="h-4 w-44 max-w-full" />
          <Skeleton className="h-11 w-56 max-w-full rounded-control" />
        </footer>
      </section>
    );
  }

  if (resource.status === 'error') {
    return (
      <section
        className="material-knowledge documents-library-surface overflow-hidden rounded-none border-0 p-4 sm:p-6"
        aria-labelledby="document-list-error-heading"
      >
        <h2 id="document-list-error-heading" className="sr-only">
          Documents
        </h2>
        <Alert className="mx-auto max-w-3xl" title="Unable to load documents" variant="error">
          <p>{resource.error.message}</p>
          <Button className="mt-3" size="small" variant="secondary" onClick={onRetry}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        </Alert>
      </section>
    );
  }

  if (resource.data.documents.length === 0) {
    return (
      <section
        className="material-knowledge documents-library-surface overflow-hidden rounded-none border-0"
        aria-labelledby="document-list-empty-heading"
      >
        <h2 id="document-list-empty-heading" className="sr-only">
          Documents
        </h2>
        <DocumentsEmptyState
          onClearSearch={onClearSearch}
          onUpload={onUpload}
          search={effectiveSearch}
          status={status}
        />
      </section>
    );
  }

  const firstResult = (resource.data.meta.page - 1) * resource.data.meta.limit + 1;
  const lastResult = firstResult + resource.data.documents.length - 1;

  return (
    <section
      className="material-knowledge documents-library-surface overflow-hidden rounded-none border-0"
      aria-labelledby="document-list-heading"
    >
      <h2 id="document-list-heading" className="sr-only">
        Documents
      </h2>

      <div className="documents-v4-table-header hidden grid-cols-[3.5rem_minmax(14rem,1fr)_7rem_10rem_7rem] gap-3 border-b border-border px-5 py-3 type-caption font-semibold uppercase tracking-[0.08em] text-muted xl:grid">
        <span aria-hidden="true">№</span>
        <span>Document</span>
        <span>Size</span>
        <span>Uploaded</span>
        <span>Status</span>
      </div>

      <ul>
        {resource.data.documents.map((document, index) => (
          <DocumentListItem
            key={document.id}
            document={document}
            ordinal={(resource.data.meta.page - 1) * resource.data.meta.limit + index + 1}
          />
        ))}
      </ul>

      <footer className="documents-pagination flex flex-col gap-4 border-t border-border bg-slate-50/45 px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
        <p className="text-center type-small text-muted md:text-left">
          Showing {firstResult}–{lastResult} of {resource.data.meta.total} documents
        </p>
        <Pagination
          currentPage={resource.data.meta.page}
          onPageChange={onPageChange}
          totalPages={resource.data.meta.totalPages}
        />
      </footer>
    </section>
  );
}
