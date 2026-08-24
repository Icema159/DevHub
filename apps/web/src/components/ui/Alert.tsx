import { CircleAlert, CircleCheck, CircleX, Info, type LucideIcon } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '../../lib/cn';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  title?: string;
  variant?: AlertVariant;
}

interface AlertStyle {
  Icon: LucideIcon;
  className: string;
}

const alertStyles: Record<AlertVariant, AlertStyle> = {
  info: { Icon: Info, className: 'border-info/15 bg-info-soft/70 text-blue-950' },
  success: { Icon: CircleCheck, className: 'border-success/15 bg-success-soft/70 text-green-950' },
  warning: { Icon: CircleAlert, className: 'border-warning/20 bg-warning-soft/75 text-amber-950' },
  error: { Icon: CircleX, className: 'border-danger/15 bg-danger-soft/75 text-red-950' },
};

export function Alert({ children, className, title, variant = 'info', ...props }: AlertProps) {
  const { Icon, className: variantClassName } = alertStyles[variant];

  return (
    <div
      className={cn('flex gap-3 rounded-control border p-4 type-body', variantClassName, className)}
      role={variant === 'error' ? 'alert' : 'status'}
      {...props}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cn(title && 'mt-1', 'text-current/80')}>{children}</div>
      </div>
    </div>
  );
}
