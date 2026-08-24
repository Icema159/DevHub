import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export type SkeletonVariant = 'text' | 'card' | 'document-row';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
}

const variantClasses: Record<SkeletonVariant, string> = {
  text: 'h-4 w-full rounded-md',
  card: 'h-32 w-full rounded-card',
  'document-row': 'h-16 w-full rounded-control',
};

export function Skeleton({ className, variant = 'text', ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-skeleton bg-gradient-to-r from-slate-100 via-indigo-50 to-slate-100 motion-reduce:animate-none',
        variantClasses[variant],
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

export interface ListSkeletonProps {
  count?: number;
}

export function ListSkeleton({ count = 3 }: ListSkeletonProps) {
  return (
    <div className="grid gap-3" aria-label="Loading list" role="status">
      <span className="sr-only">Loading</span>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} variant="document-row" />
      ))}
    </div>
  );
}
