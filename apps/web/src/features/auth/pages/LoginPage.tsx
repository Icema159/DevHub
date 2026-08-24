import { Link, useLocation, useNavigate } from 'react-router';

import { Card } from '../../../components/ui';
import { usePageTitle } from '../../../lib/page-title';
import { getRegisteredEmail, getSafeDestination } from '../auth-routing';
import { useAuthStore } from '../auth.store';
import type { AuthCredentials } from '../auth.types';
import { AuthForm } from '../components';

export function LoginPage() {
  usePageTitle('Login');

  const location = useLocation();
  const navigate = useNavigate();
  const clearError = useAuthStore((state) => state.clearError);
  const error = useAuthStore((state) => state.error);
  const login = useAuthStore((state) => state.login);
  const operation = useAuthStore((state) => state.operation);
  const destination = getSafeDestination(location.state);
  const registeredEmail = getRegisteredEmail(location.state);

  const handleSubmit = async (credentials: AuthCredentials) => {
    try {
      await login(credentials);
      navigate(destination, { replace: true });
    } catch {
      // The store exposes the normalized, user-safe error to the form.
    }
  };

  return (
    <Card className="p-6 sm:p-8" variant="glass">
      <header className="mb-7">
        <p className="type-small font-semibold tracking-wide text-primary uppercase">
          Secure account access
        </p>
        <h1 className="mt-2 type-heading-1 font-semibold text-foreground sm:type-display">
          Welcome back
        </h1>
        <p className="mt-2 type-body-large text-muted">
          Sign in to continue to your knowledge workspace.
        </p>
      </header>

      <AuthForm
        alternateAction={
          <>
            New to Developer Knowledge Hub?{' '}
            <Link
              className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              state={{ from: destination }}
              to="/register"
            >
              Create an account
            </Link>
          </>
        }
        defaultEmail={registeredEmail ?? ''}
        isSubmitting={operation === 'login'}
        mode="login"
        onChange={clearError}
        onSubmit={handleSubmit}
        {...(error ? { error: error.message } : {})}
        {...(registeredEmail
          ? {
              successMessage:
                'Check your inbox for the verification link. You can sign in now and resend it if needed.',
            }
          : {})}
      />
    </Card>
  );
}
