import { SearchInput, Skeleton } from '../../../components/ui';
import { cn } from '../../../lib/cn';
import type { DocumentStatusCounts, DocumentStatusFilter } from '../documents.types';

interface FilterOption {
  countKey: keyof DocumentStatusCounts;
  label: string;
  value: DocumentStatusFilter;
}

const filterOptions: FilterOption[] = [
  { value: 'ALL', label: 'All', countKey: 'all' },
  { value: 'READY', label: 'Ready', countKey: 'ready' },
  { value: 'PROCESSING', label: 'Processing', countKey: 'processing' },
  { value: 'FAILED', label: 'Failed', countKey: 'failed' },
];

export interface DocumentFiltersProps {
  counts: DocumentStatusCounts | null;
  onSearchChange: (value: string) => void;
  onStatusChange: (status: DocumentStatusFilter) => void;
  search: string;
  status: DocumentStatusFilter;
}

export function DocumentFilters({
  counts,
  onSearchChange,
  onStatusChange,
  search,
  status,
}: DocumentFiltersProps) {
  return (
    <section
      className="material-interaction documents-control-bar grid min-w-0 gap-4 border-0 p-4 sm:p-5 xl:grid-cols-[auto_minmax(18rem,1fr)] xl:items-center"
      aria-label="Document filters"
    >
      <div className="documents-v4-status-filters min-w-0 xl:row-start-1">
        <p className="sr-only">Processing status</p>
        <div
          className="grid max-w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:flex-nowrap"
          role="group"
          aria-label="Filter by processing status"
        >
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                'documents-v4-filter inline-flex min-h-10 min-w-0 items-center justify-between gap-2 rounded-control border px-3 type-small font-semibold transition sm:shrink-0 sm:justify-center',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                status === option.value
                  ? 'is-active border-primary/30 bg-primary-soft/95 text-primary shadow-sm'
                  : 'border-border text-secondary hover:border-primary/25 hover:text-foreground',
              )}
              aria-pressed={status === option.value}
              onClick={() => onStatusChange(option.value)}
            >
              {option.label}
              {counts ? (
                <span
                  className={cn(
                    'min-w-5 rounded-full px-1.5 py-0.5 type-caption',
                    status === option.value
                      ? 'bg-primary/15 text-primary'
                      : 'bg-white/5 text-muted',
                  )}
                >
                  {counts[option.countKey]}
                </span>
              ) : (
                <Skeleton className="h-4 w-5 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="documents-v4-search xl:row-start-1 xl:justify-self-end">
        <SearchInput
          label="Search documents"
          onValueChange={onSearchChange}
          placeholder="Search documents"
          value={search}
        />
      </div>
    </section>
  );
}
