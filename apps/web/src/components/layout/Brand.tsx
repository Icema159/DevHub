import { Link } from 'react-router';

import { cn } from '../../lib/cn';
import { DkhMark } from './DkhMark';

export interface BrandProps {
  className?: string;
  subtitle?: string;
}

export function Brand({ className, subtitle }: BrandProps) {
  return (
    <Link
      to="/dashboard"
      className={cn(
        'focus-material inline-flex items-center gap-3 rounded-control text-foreground',
        className,
      )}
      aria-label="Developer Knowledge Hub dashboard"
    >
      <span className="flex size-9 shrink-0 items-center justify-center">
        <DkhMark className="size-8" />
      </span>
      <span className="min-w-0">
        <span className="block whitespace-nowrap type-body font-semibold leading-5 tracking-tight">
          Developer Knowledge Hub
        </span>
        {subtitle ? (
          <span className="chat-dark-v4-brand-caption mt-0.5 block type-caption font-medium text-muted">
            {subtitle}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
