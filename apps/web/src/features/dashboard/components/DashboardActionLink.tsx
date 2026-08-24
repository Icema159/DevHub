import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

export interface DashboardActionLinkProps {
  description: string;
  icon: LucideIcon;
  label: string;
  to: string;
}

export function DashboardActionLink({
  description,
  icon: Icon,
  label,
  to,
}: DashboardActionLinkProps) {
  return (
    <Link
      className="material-interaction dashboard-action focus-material group flex min-h-28 min-w-0 items-center gap-4 overflow-hidden rounded-glass border p-5 transition duration-200 hover:border-primary/25 active:translate-y-px motion-reduce:transform-none"
      to={to}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-card bg-gradient-to-br from-primary to-indigo-700 text-white shadow-glass-low">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block type-heading-3 font-semibold text-foreground">{label}</span>
        <span className="mt-1 block type-body text-muted">{description}</span>
      </span>
      <ArrowRight
        className="ml-auto size-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transform-none"
        aria-hidden="true"
      />
    </Link>
  );
}
