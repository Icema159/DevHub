import { useEffect, type ReactNode } from 'react';

import { subscribeToUnauthorized } from '../../../lib/auth-events';
import { useAuthStore } from '../auth.store';

export function AuthSessionBootstrap({ children }: { children: ReactNode }) {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const expireSession = useAuthStore((state) => state.expireSession);
  const status = useAuthStore((state) => state.status);

  useEffect(() => subscribeToUnauthorized(expireSession), [expireSession]);

  useEffect(() => {
    if (status === 'idle') {
      void checkAuth();
    }
  }, [checkAuth, status]);

  return children;
}
