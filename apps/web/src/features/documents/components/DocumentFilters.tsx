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
      className="material-interaction documents-control-bar elevation-1 grid min-w-0 gap-5 overflow-hidden rounded-glass border p-4 sm:p-5 xl:grid-cols-[minmax(20rem,1fr)_auto] xl:items-end"
      aria-label="Document filters"
    >
      <SearchInput
        label="Search documents"
        onValueChange={onSearchChange}
        placeholder="Search by document name…"
        value={search}
      />

      <div className="min-w-0 xl:justify-self-end">
        <p className="mb-2 type-body font-medium text-foreground">Processing status</p>
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
                'inline-flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-control border px-3.5 type-body font-semibold transition sm:shrink-0 sm:justify-center',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                status === option.value
                  ? 'border-primary/30 bg-primary-soft/95 text-primary shadow-sm'
                  : 'border-border bg-white/92 text-secondary hover:border-primary/25 hover:bg-white hover:text-foreground',
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
                      ? 'bg-white/80 text-primary'
                      : 'bg-slate-100 text-muted',
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
    </section>
  );
}
