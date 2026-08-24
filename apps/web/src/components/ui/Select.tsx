import { ChevronDown } from 'lucide-react';
import { forwardRef, useId, type SelectHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  label: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, disabled, error, id, label, options, placeholder, required, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;

  return (
    <div className="grid gap-2">
      <label htmlFor={selectId} className="type-body font-medium text-foreground">
        {label}
        {required ? (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'min-h-11 w-full appearance-none rounded-control border bg-white/90 py-2 pr-10 pl-3 type-body text-foreground shadow-sm outline-none transition',
            'hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-primary/15',
            'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-muted',
            error && 'border-danger focus:border-danger focus:ring-danger/15',
            className,
          )}
          disabled={disabled}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          {...props}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
      </div>
      {error ? (
        <p id={errorId} className="type-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
});
