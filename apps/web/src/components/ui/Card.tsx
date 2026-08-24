import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

import { cn } from '../../lib/cn';

export type CardVariant = 'glass' | 'elevated' | 'interactive' | 'solid';

interface BaseCardProps {
  children: ReactNode;
  className?: string;
}

interface InteractiveCardProps
  extends BaseCardProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  variant: 'interactive';
}

interface StaticCardProps
  extends BaseCardProps, Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'children'> {
  variant?: Exclude<CardVariant, 'interactive'>;
}

export type CardProps = InteractiveCardProps | StaticCardProps;

const cardClasses: Record<CardVariant, string> = {
  glass: 'material-workspace elevation-1',
  elevated: 'material-interaction elevation-2',
  solid: 'material-knowledge elevation-0',
  interactive:
    'material-workspace elevation-1 w-full text-left hover:-translate-y-0.5 hover:border-primary/25 active:translate-y-0',
};

export function Card(props: CardProps) {
  if (props.variant === 'interactive') {
    const { children, className, type = 'button', variant: _variant, ...buttonProps } = props;
    void _variant;

    return (
      <button
        type={type}
        className={cn(
          'focus-material rounded-card border p-5 transition duration-200',
          cardClasses.interactive,
          className,
        )}
        {...buttonProps}
      >
        {children}
      </button>
    );
  }

  const { children, className, variant = 'solid', ...divProps } = props;

  return (
    <div className={cn('rounded-card border p-5', cardClasses[variant], className)} {...divProps}>
      {children}
    </div>
  );
}
