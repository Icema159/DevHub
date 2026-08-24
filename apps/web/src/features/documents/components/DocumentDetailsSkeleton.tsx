import { Skeleton } from '../../../components/ui';

export function DocumentDetailsSkeleton() {
  return (
    <div aria-label="Loading document details" role="status">
      <span className="sr-only">Loading document details</span>

      <div className="material-interaction elevation-1 rounded-glass border p-5 sm:p-6">
        <div className="flex gap-4">
          <Skeleton className="size-14 shrink-0 sm:size-16" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-7 max-w-xl sm:h-9" />
            <Skeleton className="mt-3 h-6 max-w-40 rounded-full" />
            <Skeleton className="mt-4 max-w-2xl" />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.8fr)] xl:gap-6">
        <div className="material-knowledge elevation-0 order-2 rounded-card border p-5 sm:p-6 xl:order-1">
          <Skeleton className="h-6 max-w-48" />
          <div className="mt-5 grid gap-4">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-11" />
            ))}
          </div>
        </div>
        <Skeleton className="order-1 min-h-48 xl:order-2" variant="card" />
      </div>
    </div>
  );
}
