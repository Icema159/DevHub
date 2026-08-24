import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../../lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  helperText?: string;
  label: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    disabled,
    error,
    helperText,
    id,
    label,
    leadingIcon,
    required,
    trailingIcon,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const hasMessage = Boolean(error || helperText);

  return (
    <div className="grid gap-2">
      <label htmlFor={inputId} className="type-body font-medium text-foreground">
        {label}
        {required ? (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      <div className="relative">
        {leadingIcon ? (
          <span
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted"
            aria-hidden="true"
          >
            {leadingIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'min-h-11 w-full rounded-control border bg-white/90 px-3 type-body text-foreground shadow-sm outline-none transition',
            'placeholder:text-subtle hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-primary/15',
            'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-muted',
            leadingIcon && 'pl-10',
            trailingIcon && 'pr-10',
            error && 'border-danger focus:border-danger focus:ring-danger/15',
            className,
          )}
          disabled={disabled}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={hasMessage ? messageId : undefined}
          {...props}
        />
        {trailingIcon ? (
          <span
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted"
            aria-hidden="true"
          >
            {trailingIcon}
          </span>
        ) : null}
      </div>
      {hasMessage ? (
        <p id={messageId} className={cn('type-small', error ? 'text-danger' : 'text-muted')}>
          {error ?? helperText}
        </p>
      ) : null}
    </div>
  );
});
