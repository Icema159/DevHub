import { LoaderCircle } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingLabel?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-primary text-on-primary shadow-glass-low hover:bg-primary-hover active:bg-primary-active',
  secondary:
    'border-border-strong bg-white/90 text-foreground shadow-sm hover:border-primary/30 hover:bg-primary-soft/70 active:bg-primary-soft',
  ghost:
    'border-transparent bg-transparent text-secondary hover:bg-white/70 hover:text-foreground active:bg-white/90',
  destructive:
    'border-transparent bg-danger text-on-danger shadow-sm hover:bg-danger-hover active:bg-danger-active',
};

const sizeClasses: Record<ButtonSize, string> = {
  small: 'min-h-9 rounded-[10px] px-3 type-small',
  medium: 'min-h-11 rounded-control px-4 type-body',
  large: 'min-h-12 rounded-control px-5 type-body-large',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    disabled,
    isLoading = false,
    loadingLabel = 'Loading',
    size = 'medium',
    type = 'button',
    variant = 'primary',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 border font-semibold transition duration-150',
        'focus-material',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      <span
        className={cn('inline-flex items-center justify-center gap-2', isLoading && 'invisible')}
        aria-hidden={isLoading}
      >
        {children}
      </span>
      {isLoading ? (
        <span
          className="absolute inset-0 inline-flex items-center justify-center gap-2"
          role="status"
        >
          <LoaderCircle
            className="size-4 animate-soft-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span>{loadingLabel}</span>
        </span>
      ) : null}
    </button>
  );
});
