import { CircleAlert, CircleCheck, LoaderCircle, type LucideIcon } from 'lucide-react';

import { cn } from '../../lib/cn';

export type PublicDocumentStatus = 'ready' | 'processing' | 'failed';

export interface StatusBadgeProps {
  className?: string;
  status: PublicDocumentStatus;
}

interface StatusStyle {
  Icon: LucideIcon;
  className: string;
  iconClassName?: string;
  label: string;
}

const statusStyles: Record<PublicDocumentStatus, StatusStyle> = {
  ready: {
    Icon: CircleCheck,
    label: 'Ready',
    className:
      'border-status-ready-border/60 bg-status-ready-background text-status-ready-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]',
  },
  processing: {
    Icon: LoaderCircle,
    label: 'Processing',
    className:
      'border-status-processing-border/65 bg-status-processing-background text-status-processing-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]',
    iconClassName: 'animate-soft-spin motion-reduce:animate-none',
  },
  failed: {
    Icon: CircleAlert,
    label: 'Failed',
    className:
      'border-status-failed-border/60 bg-status-failed-background text-status-failed-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]',
  },
};

export function StatusBadge({ className, status }: StatusBadgeProps) {
  const { Icon, className: statusClassName, iconClassName, label } = statusStyles[status];

  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 type-small font-medium',
        statusClassName,
        className,
      )}
      data-status={status}
    >
      <Icon className={cn('size-3.5', iconClassName)} aria-hidden="true" />
      {label}
    </span>
  );
}
