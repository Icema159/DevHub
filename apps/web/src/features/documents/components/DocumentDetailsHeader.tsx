import { FileText, RefreshCw } from 'lucide-react';

import { Button, StatusBadge } from '../../../components/ui';
import { formatAbsoluteDate, formatRelativeDate } from '../../../lib/date-format';
import { formatFileSize } from '../../../lib/file-format';
import type { PublicDocumentDetails } from '../documents.types';

export interface DocumentDetailsHeaderProps {
  document: PublicDocumentDetails;
  isRefreshing: boolean;
  onRefresh: () => void;
  refreshDisabled?: boolean;
}

const statusSummary = {
  failed: 'This document could not be processed successfully.',
  processing: 'This document is being prepared for AI search.',
  ready: 'This document is available for AI search and grounded answers.',
} as const;

export function DocumentDetailsHeader({
  document,
  isRefreshing,
  onRefresh,
  refreshDisabled = false,
}: DocumentDetailsHeaderProps) {
  return (
    <header className="material-interaction document-details-identity elevation-1 rounded-glass border p-5 sm:p-6">
      <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4 sm:gap-5">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-card border border-primary/10 bg-primary-soft/65 text-primary sm:size-16">
            <FileText className="size-7 sm:size-8" aria-hidden="true" />
          </span>

          <div className="min-w-0">
            <h1
              className="line-clamp-3 break-words type-heading-1 font-semibold tracking-tight text-foreground [overflow-wrap:anywhere] sm:line-clamp-2 sm:type-display"
              title={document.filename}
            >
              {document.filename}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <StatusBadge status={document.status} />
              <span className="type-small text-muted" aria-hidden="true">
                {formatFileSize(document.size)}
              </span>
              <time
                className="type-small text-muted"
                dateTime={document.updatedAt}
                title={formatAbsoluteDate(document.updatedAt)}
              >
                Updated {formatRelativeDate(document.updatedAt)}
              </time>
            </div>

            <p className="mt-3 max-w-2xl type-body text-secondary">
              {statusSummary[document.status]}
            </p>
          </div>
        </div>

        <Button
          className="document-details-refresh w-full shrink-0 sm:w-auto"
          disabled={refreshDisabled}
          isLoading={isRefreshing}
          loadingLabel="Refreshing…"
          onClick={onRefresh}
          variant="secondary"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>
    </header>
  );
}
