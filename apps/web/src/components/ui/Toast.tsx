import { CircleCheck, CircleX, Info, X, type LucideIcon } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { cn } from '../../lib/cn';
import { IconButton } from './IconButton';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastInput {
  message: string;
  title: string;
  variant?: ToastVariant;
}

interface ToastItem extends ToastInput {
  id: number;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
let nextToastId = 0;

const toastStyles: Record<ToastVariant, { Icon: LucideIcon; iconClassName: string }> = {
  success: { Icon: CircleCheck, iconClassName: 'text-success' },
  error: { Icon: CircleX, iconClassName: 'text-danger' },
  info: { Icon: Info, iconClassName: 'text-info' },
};

export interface ToastProviderProps {
  children: ReactNode;
  duration?: number;
}

export function ToastProvider({ children, duration = 5000 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutsRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timeout = timeoutsRef.current.get(id);

    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    ({ message, title, variant = 'info' }: ToastInput) => {
      nextToastId += 1;
      const id = nextToastId;

      setToasts((current) => [...current, { id, message, title, variant }]);
      const timeout = setTimeout(() => dismissToast(id), duration);
      timeoutsRef.current.set(id, timeout);
    },
    [dismissToast, duration],
  );

  useEffect(
    () => () => {
      for (const timeout of timeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
      timeoutsRef.current.clear();
    },
    [],
  );

  return (
    <ToastContext value={{ showToast }}>
      {children}
      <ol
        className="pointer-events-none fixed right-4 bottom-4 z-50 grid w-[min(24rem,calc(100%-2rem))] gap-3"
        aria-label="Notifications"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const { Icon, iconClassName } = toastStyles[toast.variant];

          return (
            <li
              key={toast.id}
              className={cn(
                'material-interaction elevation-2 pointer-events-auto flex items-start gap-3 rounded-card border p-4',
                'animate-toast-in motion-reduce:animate-none',
              )}
              role={toast.variant === 'error' ? 'alert' : 'status'}
            >
              <Icon className={cn('mt-0.5 size-5 shrink-0', iconClassName)} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="type-body font-semibold text-foreground">{toast.title}</p>
                <p className="mt-0.5 type-small text-muted">{toast.message}</p>
              </div>
              <IconButton
                className="-mt-1 -mr-1 size-8 border-transparent bg-transparent shadow-none"
                label="Dismiss notification"
                onClick={() => dismissToast(toast.id)}
              >
                <X className="size-4" aria-hidden="true" />
              </IconButton>
            </li>
          );
        })}
      </ol>
    </ToastContext>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider.');
  }

  return context;
}
