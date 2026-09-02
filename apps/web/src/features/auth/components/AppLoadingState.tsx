import { LoaderCircle, RefreshCw } from 'lucide-react';

import { Brand } from '../../../components/layout';
import { AmbientLightLayer } from '../../../components/layout/AmbientLightLayer';
import { Alert, Button, Card } from '../../../components/ui';

export interface AppLoadingStateProps {
  error?: string;
  onRetry?: () => void;
}

export function AppLoadingState({ error, onRetry }: AppLoadingStateProps) {
  return (
    <main className="app-canvas overview-v4-identity auth-v4-identity relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <AmbientLightLayer />

      <Card className="relative z-10 w-full max-w-md p-7 text-center sm:p-8" variant="glass">
        <Brand className="justify-center" />
        {error ? (
          <>
            <Alert className="mt-7 text-left" title="Unable to check your session" variant="error">
              {error}
            </Alert>
            {onRetry ? (
              <Button
                className="auth-v4-secondary-button mt-5 w-full"
                onClick={onRetry}
                variant="secondary"
              >
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
