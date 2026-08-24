import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

export interface EmptyStateProps {
  className?: string;
  description: string;
  icon: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  title: string;
}

export function EmptyState({
  className,
  description,
  icon,
  primaryAction,
  secondaryAction,
  title,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-card border border-dashed border-border-strong bg-white/65 px-6 py-10 text-center',
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-card bg-primary-soft text-primary">
        {icon}
      </div>
      <h3 className="mt-4 type-heading-3 font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-md type-body text-muted">{description}</p>
      {primaryAction || secondaryAction ? (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {primaryAction}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
