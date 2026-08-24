import { Skeleton } from '../../../components/ui';

export function ConversationListSkeleton() {
  return (
    <div className="grid gap-2 p-3" aria-label="Loading conversations" role="status">
      <span className="sr-only">Loading conversations</span>
      {Array.from({ length: 6 }, (_, index) => (
        <div
          className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-control px-3 py-3"
          key={index}
        >
          <Skeleton className="size-10 rounded-control" />
          <div className="min-w-0 space-y-2 pt-0.5">
            <Skeleton className="max-w-40" />
            <Skeleton className="max-w-56" />
          </div>
        </div>
      ))}
    </div>
  );
}
