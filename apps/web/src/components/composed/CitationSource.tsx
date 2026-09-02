import { FileText } from 'lucide-react';
import { forwardRef } from 'react';
import { Link, type LinkProps } from 'react-router';

import { cn } from '../../lib/cn';

export interface CitationSourceProps extends Omit<LinkProps, 'children'> {
  filename: string;
  isActive?: boolean;
  page?: number;
  sourceLabel: string;
}

export const CitationSource = forwardRef<HTMLAnchorElement, CitationSourceProps>(
  function CitationSource(
    { className, filename, isActive = false, page, sourceLabel, ...props },
    ref,
  ) {
    const accessibleLabel =
      props['aria-label'] ??
      `Source ${sourceLabel}: ${filename}${page === undefined ? '' : `, page ${page}`}`;

    return (
      <Link
        {...props}
        ref={ref}
        aria-label={accessibleLabel}
        data-active={isActive || undefined}
        className={cn(
          'chat-citation-source focus-material group flex min-w-0 items-center gap-3 rounded-control border border-border/80 bg-white/92 p-3 text-left shadow-glass-low transition',
          'hover:border-primary/25 hover:bg-white',
          className,
        )}
      >
        <span className="chat-citation-source-icon flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
          <FileText className="size-4" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="chat-citation-source-label shrink-0 type-caption font-semibold text-primary">
            {sourceLabel}
          </span>
          <span className="min-w-0 break-words type-small font-medium text-foreground [overflow-wrap:anywhere]">
            {filename}
          </span>
          {page === undefined ? null : <span className="type-caption text-muted">Page {page}</span>}
        </span>
      </Link>
    );
  },
);
