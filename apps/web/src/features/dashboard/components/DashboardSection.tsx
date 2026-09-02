import type { ReactNode } from 'react';

import { Card } from '../../../components/ui';
import { cn } from '../../../lib/cn';

export interface DashboardSectionProps {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  title: string;
}

export function DashboardSection({ action, children, className, title }: DashboardSectionProps) {
  return (
    <Card className={cn('overview-v4-section min-w-0', className)} variant="solid">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="type-heading-3 font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}
