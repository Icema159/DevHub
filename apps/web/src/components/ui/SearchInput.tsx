import { Search, X } from 'lucide-react';
import { useId, type InputHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';
import { IconButton } from './IconButton';

export interface SearchInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'type' | 'value'
> {
  error?: string;
  label?: string;
  onValueChange: (value: string) => void;
  value: string;
}

export function SearchInput({
  className,
  disabled,
  error,
  id,
  label,
  onValueChange,
  value,
  ...props
}: SearchInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="grid gap-2">
      {label ? (
        <label htmlFor={inputId} className="type-body font-medium text-foreground">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          id={inputId}
          type="search"
          value={value}
          className={cn(
            'min-h-11 w-full rounded-control border bg-white/90 pr-12 pl-10 type-body text-foreground shadow-sm outline-none transition',
            '[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none',
            'placeholder:text-subtle hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-primary/15',
            'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-muted',
            error && 'border-danger focus:border-danger focus:ring-danger/15',
            className,
          )}
          disabled={disabled}
          onChange={(event) => onValueChange(event.target.value)}
          aria-label={label ? undefined : 'Search'}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          {...props}
        />
        {value && !disabled ? (
          <IconButton
            className="absolute top-1/2 right-0 size-11 -translate-y-1/2 border-transparent bg-transparent shadow-none"
            label="Clear search"
            onClick={() => onValueChange('')}
          >
            <X className="size-4" aria-hidden="true" />
          </IconButton>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} className="type-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
