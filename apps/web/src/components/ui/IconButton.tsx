import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export type IconButtonVariant = 'neutral' | 'primary' | 'destructive';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label'
> {
  label: string;
  variant?: IconButtonVariant;
}

const variantClasses: Record<IconButtonVariant, string> = {
  neutral:
    'border-border bg-white/80 text-secondary hover:border-primary/30 hover:bg-white hover:text-foreground',
  primary:
    'border-primary/20 bg-primary-soft/80 text-primary hover:border-primary/40 hover:bg-primary-soft',
  destructive:
    'border-danger/20 bg-danger-soft/70 text-danger hover:border-danger/40 hover:bg-danger-soft',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    children,
    className,
    disabled,
    label,
    title = label,
    type = 'button',
    variant = 'neutral',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'focus-material inline-flex size-11 shrink-0 items-center justify-center rounded-control border shadow-sm transition',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        className,
      )}
      disabled={disabled}
      aria-label={label}
      title={title}
      {...props}
    >
      {children}
    </button>
  );
});
