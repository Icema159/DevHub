import { FileText } from 'lucide-react';
import { Link } from 'react-router';

import { StatusBadge } from '../../../components/ui';
import { formatAbsoluteDate, formatRelativeDate } from '../../../lib/date-format';
import { formatFileSize } from '../../../lib/file-format';
import type { PublicDocument } from '../documents.types';

export interface DocumentListItemProps {
  document: PublicDocument;
}

export function DocumentListItem({ document }: DocumentListItemProps) {
  return (
    <li className="group grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-t border-border/80 px-4 py-3 first:border-t-0 transition-colors first-of-type:border-t-0 hover:bg-primary-soft/24 focus-within:bg-primary-soft/32 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center xl:grid-cols-[auto_minmax(14rem,1fr)_9rem_7rem_10rem] xl:px-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-danger-soft/65 text-danger">
        <FileText className="size-5" aria-hidden="true" />
      </span>

      <span className="min-w-0">
        <Link
          aria-label={`Open document ${document.filename}`}
          className="focus-material inline-flex min-h-11 max-w-full items-center rounded-sm type-body font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline sm:block sm:min-h-0 sm:truncate"
          title={document.filename}
          to={`/documents/${encodeURIComponent(document.id)}`}
        >
          <span className="line-clamp-2 [overflow-wrap:anywhere] sm:line-clamp-1">
            {document.filename}
          </span>
        </Link>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 type-small text-muted xl:hidden">
          <span>{formatFileSize(document.size)}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={document.createdAt} title={formatAbsoluteDate(document.createdAt)}>
            {formatRelativeDate(document.createdAt)}
          </time>
        </span>
      </span>

      <StatusBadge
        className="col-start-2 justify-self-start sm:col-start-3 sm:row-start-1 sm:justify-self-end xl:col-start-3 xl:justify-self-start"
        status={document.status}
      />

      <span className="hidden type-body text-secondary xl:block">
        {formatFileSize(document.size)}
      </span>

      <time
        className="hidden type-small text-muted xl:block"
        dateTime={document.createdAt}
        title={formatAbsoluteDate(document.createdAt)}
      >
        {formatRelativeDate(document.createdAt)}
      </time>
    </li>
  );
}
