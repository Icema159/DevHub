import { FileText, Files } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState, ListSkeleton, StatusBadge } from '../../../components/ui';
import { formatAbsoluteDate, formatRelativeDate } from '../../../lib/date-format';
import type { DashboardDocumentList, DashboardResource } from '../dashboard.types';
import { DashboardSection } from './DashboardSection';
import { DashboardSectionError } from './DashboardSectionError';

export interface RecentDocumentsProps {
  onRetry: () => void;
  resource: DashboardResource<DashboardDocumentList>;
}

export function RecentDocuments({ onRetry, resource }: RecentDocumentsProps) {
  return (
    <DashboardSection
      action={
        <Link
          className="focus-material -my-2 inline-flex min-h-10 items-center rounded-control px-2 type-small font-semibold text-primary underline-offset-4 hover:underline"
          to="/documents"
        >
          View all
        </Link>
      }
      className="min-w-0"
      title="Recent documents"
    >
      {resource.status === 'loading' ? <ListSkeleton count={5} /> : null}

      {resource.status === 'error' ? (
        <DashboardSectionError message={resource.error.message} onRetry={onRetry} />
      ) : null}

      {resource.status === 'success' && resource.data.documents.length === 0 ? (
        <EmptyState
          className="overview-v4-empty-state py-8"
          description="Your recently uploaded documents will appear here."
          icon={<Files className="size-6" aria-hidden="true" />}
          title="No documents yet"
        />
      ) : null}

      {resource.status === 'success' && resource.data.documents.length > 0 ? (
        <ul className="overview-v4-rows divide-y divide-border/80">
          {resource.data.documents.map((document) => (
            <li
              key={document.id}
              className="overview-v4-row grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-2 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
            >
              <span className="overview-document-icon flex size-9 shrink-0 items-center justify-center rounded-control bg-info-soft text-info">
                <FileText className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span
                  className="block truncate type-body font-medium text-foreground"
                  title={document.filename}
                >
                  {document.filename}
                </span>
                <time
                  className="mt-0.5 block type-small text-muted"
                  dateTime={document.createdAt}
                  title={formatAbsoluteDate(document.createdAt)}
                >
                  {formatRelativeDate(document.createdAt)}
                </time>
              </span>
              <StatusBadge
                className="col-start-2 sm:col-start-3 sm:row-start-1"
                status={document.status}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </DashboardSection>
  );
}
