import { Navigate, Outlet, useLocation } from 'react-router';

import { AppLoadingState, useAuthStore } from '../features/auth';

function useSessionGate() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const error = useAuthStore((state) => state.error);
  const status = useAuthStore((state) => state.status);

  if (status === 'idle' || status === 'checking') {
    return <AppLoadingState />;
  }

  if (status === 'unavailable') {
    return (
      <AppLoadingState
        error={error?.message ?? 'Unable to connect to the service. Try again.'}
        onRetry={() => void checkAuth()}
      />
    );
  }

  return null;
}

export function ProtectedRoute() {
  const location = useLocation();
  const status = useAuthStore((state) => state.status);
  const sessionGate = useSessionGate();

  if (sessionGate) {
    return sessionGate;
  }

  if (status !== 'authenticated') {
    const intendedDestination = `${location.pathname}${location.search}${location.hash}`;

    return <Navigate replace state={{ from: intendedDestination }} to="/login" />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const status = useAuthStore((state) => state.status);
  const sessionGate = useSessionGate();

  if (sessionGate) {
    return sessionGate;
  }

  if (status === 'authenticated') {
    return <Navigate replace to="/dashboard" />;
  }

  return <Outlet />;
}

export function HomeRoute() {
  const status = useAuthStore((state) => state.status);
  const sessionGate = useSessionGate();

  if (sessionGate) {
    return sessionGate;
  }

  return <Navigate replace to={status === 'authenticated' ? '/dashboard' : '/login'} />;
}
