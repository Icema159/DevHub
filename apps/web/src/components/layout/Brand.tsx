import { Network } from 'lucide-react';
import { Link } from 'react-router';

import { cn } from '../../lib/cn';

export interface BrandProps {
  className?: string;
}

export function Brand({ className }: BrandProps) {
  return (
    <Link
      to="/dashboard"
      className={cn(
        'focus-material inline-flex items-center gap-3 rounded-control text-foreground',
        className,
      )}
      aria-label="Developer Knowledge Hub dashboard"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-card bg-gradient-to-br from-primary to-primary-active text-on-primary shadow-glass-low">
        <Network className="size-5" strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="whitespace-nowrap type-body font-semibold leading-5 tracking-tight">
        Developer Knowledge Hub
      </span>
    </Link>
  );
}
