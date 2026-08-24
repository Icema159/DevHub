import { CircleCheck, FileWarning } from 'lucide-react';
import { Link } from 'react-router';

import { ListSkeleton, StatusBadge } from '../../../components/ui';
import { formatAbsoluteDate, formatRelativeDate } from '../../../lib/date-format';
import type { DashboardDocumentList, DashboardResource } from '../dashboard.types';
import { DashboardSection } from './DashboardSection';
import { DashboardSectionError } from './DashboardSectionError';

export interface AttentionDocumentsProps {
  className?: string;
  onRetry: () => void;
  resource: DashboardResource<DashboardDocumentList>;
}

export function AttentionDocuments({ className, onRetry, resource }: AttentionDocumentsProps) {
  const hasFailedDocuments = resource.status === 'success' && resource.data.documents.length > 0;

  return (
    <DashboardSection
      action={
        hasFailedDocuments ? (
          <Link
            className="focus-material -my-2 inline-flex min-h-10 items-center rounded-control px-2 type-small font-semibold text-primary underline-offset-4 hover:underline"
            to="/documents"
          >
            Open documents
          </Link>
        ) : null
      }
      title="Documents requiring attention"
      {...(className ? { className } : {})}
    >
      {resource.status === 'loading' ? <ListSkeleton count={3} /> : null}

      {resource.status === 'error' ? (
        <DashboardSectionError message={resource.error.message} onRetry={onRetry} />
      ) : null}

      {resource.status === 'success' && resource.data.documents.length === 0 ? (
        <div className="flex items-start gap-3 rounded-card border border-success/15 bg-success-soft/55 p-4 text-green-950">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          <div>
            <h3 className="type-body font-semibold">All documents are on track</h3>
            <p className="mt-1 type-body text-green-950/75">
              No documents currently require your attention.
            </p>
          </div>
        </div>
      ) : null}

      {hasFailedDocuments ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {resource.data.documents.map((document) => (
            <li
              key={document.id}
              className="flex min-w-0 items-start gap-3 rounded-card border border-danger/10 bg-danger-soft/35 p-4"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-white/75 text-danger">
                <FileWarning className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate type-body font-medium text-foreground"
                  title={document.filename}
                >
                  {document.filename}
                </span>
                <time
                  className="mt-1 block type-small text-muted"
                  dateTime={document.updatedAt}
                  title={formatAbsoluteDate(document.updatedAt)}
                >
                  Updated {formatRelativeDate(document.updatedAt)}
                </time>
                <StatusBadge className="mt-2" status="failed" />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </DashboardSection>
  );
}
