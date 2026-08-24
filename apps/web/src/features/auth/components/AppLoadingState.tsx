import { LoaderCircle, RefreshCw } from 'lucide-react';

import { Brand } from '../../../components/layout';
import { Alert, Button, Card } from '../../../components/ui';

export interface AppLoadingStateProps {
  error?: string;
  onRetry?: () => void;
}

export function AppLoadingState({ error, onRetry }: AppLoadingStateProps) {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-44 -left-36 size-[30rem] rounded-full bg-indigo-200/45 blur-3xl" />
        <div className="absolute -right-40 -bottom-48 size-[34rem] rounded-full bg-sky-200/35 blur-3xl" />
      </div>

      <Card className="w-full max-w-md p-7 text-center sm:p-8" variant="glass">
        <Brand className="justify-center" />
        {error ? (
          <>
            <Alert className="mt-7 text-left" title="Unable to check your session" variant="error">
              {error}
            </Alert>
            {onRetry ? (
              <Button className="mt-5 w-full" onClick={onRetry} variant="secondary">
                <RefreshCw className="size-4" aria-hidden="true" />
                Try again
              </Button>
            ) : null}
          </>
        ) : (
          <div className="mt-8" role="status" aria-live="polite">
            <LoaderCircle
              className="mx-auto size-7 animate-soft-spin text-primary motion-reduce:animate-none"
              aria-hidden="true"
            />
            <p className="mt-4 type-body font-medium text-foreground">Checking your session…</p>
            <span className="sr-only">Please wait while your session is checked.</span>
          </div>
        )}
      </Card>
    </main>
  );
}
