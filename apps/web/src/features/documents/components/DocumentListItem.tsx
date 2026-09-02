import { Link } from 'react-router';

import { StatusBadge } from '../../../components/ui';
import { formatAbsoluteDate, formatRelativeDate } from '../../../lib/date-format';
import { formatFileSize } from '../../../lib/file-format';
import type { PublicDocument } from '../documents.types';

export interface DocumentListItemProps {
  document: PublicDocument;
  ordinal: number;
}

export function DocumentListItem({ document, ordinal }: DocumentListItemProps) {
  return (
    <li className="documents-v4-row group grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-t border-border/80 px-4 py-3 first:border-t-0 transition-colors first-of-type:border-t-0 hover:bg-primary-soft/24 focus-within:bg-primary-soft/32 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center xl:grid-cols-[3.5rem_minmax(14rem,1fr)_7rem_10rem_7rem] xl:px-5">
      <span
        className="documents-v4-ordinal self-center font-mono type-small text-muted"
        aria-hidden="true"
      >
        {String(ordinal).padStart(3, '0')}
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
        className="col-start-2 justify-self-start sm:col-start-3 sm:row-start-1 sm:justify-self-end xl:col-start-5 xl:justify-self-start"
        status={document.status}
      />

      <span className="hidden type-small text-secondary xl:col-start-3 xl:row-start-1 xl:block">
        {formatFileSize(document.size)}
      </span>

      <time
        className="hidden type-small text-muted xl:col-start-4 xl:row-start-1 xl:block"
        dateTime={document.createdAt}
        title={formatAbsoluteDate(document.createdAt)}
      >
        {formatRelativeDate(document.createdAt)}
      </time>
    </li>
  );
}
