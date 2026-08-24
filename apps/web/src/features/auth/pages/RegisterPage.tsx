import { Link, useLocation, useNavigate } from 'react-router';

import { Card } from '../../../components/ui';
import { usePageTitle } from '../../../lib/page-title';
import { getSafeDestination } from '../auth-routing';
import { useAuthStore } from '../auth.store';
import type { AuthCredentials } from '../auth.types';
import { AuthForm } from '../components';

export function RegisterPage() {
  usePageTitle('Register');

  const location = useLocation();
  const navigate = useNavigate();
  const clearError = useAuthStore((state) => state.clearError);
  const error = useAuthStore((state) => state.error);
  const operation = useAuthStore((state) => state.operation);
  const register = useAuthStore((state) => state.register);
  const destination = getSafeDestination(location.state);

  const handleSubmit = async (credentials: AuthCredentials) => {
    try {
      await register(credentials);
      navigate('/login', {
        replace: true,
        state: {
          email: credentials.email.trim().toLowerCase(),
          from: destination,
          registrationComplete: true,
        },
      });
    } catch {
      // The store exposes the normalized, user-safe error to the form.
    }
  };

  return (
    <Card className="p-6 sm:p-8" variant="glass">
      <header className="mb-7">
        <p className="type-small font-semibold tracking-wide text-primary uppercase">
          Create your workspace
        </p>
        <h1 className="mt-2 type-heading-1 font-semibold text-foreground sm:type-display">
          Create an account
        </h1>
        <p className="mt-2 type-body-large text-muted">
          Start building a private, searchable technical knowledge base.
        </p>
      </header>

      <AuthForm
        alternateAction={
          <>
            Already have an account?{' '}
            <Link
              className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              state={{ from: destination }}
              to="/login"
            >
              Sign in
            </Link>
          </>
        }
        isSubmitting={operation === 'register'}
        mode="register"
        onChange={clearError}
        onSubmit={handleSubmit}
        {...(error ? { error: error.message } : {})}
      />
    </Card>
  );
}
