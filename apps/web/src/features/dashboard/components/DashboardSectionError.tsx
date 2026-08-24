import { RefreshCw } from 'lucide-react';

import { Alert, Button } from '../../../components/ui';

export interface DashboardSectionErrorProps {
  message: string;
  onRetry: () => void;
}

export function DashboardSectionError({ message, onRetry }: DashboardSectionErrorProps) {
  return (
    <Alert title="Unable to load this section" variant="error">
      <p>{message}</p>
      <Button className="mt-3" onClick={onRetry} size="small" variant="secondary">
        <RefreshCw className="size-4" aria-hidden="true" />
        Retry
      </Button>
    </Alert>
  );
}
