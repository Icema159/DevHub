import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { Button, Card } from '../../../components/ui';
import { ApiClientError } from '../../../lib/api-client';
import { usePageTitle } from '../../../lib/page-title';
import * as authService from '../auth.service';
import { useAuthStore } from '../auth.store';

type VerificationState = 'verifying' | 'verified' | 'invalid';

function tokenFromHash(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get('token');
}

export function VerifyEmailPage() {
  usePageTitle('Verify email');

  const location = useLocation();
  const navigate = useNavigate();
  const authStatus = useAuthStore((state) => state.status);
  const refreshCurrentUser = useAuthStore((state) => state.refreshCurrentUser);
  const [token] = useState(() => tokenFromHash(location.hash));
  const [state, setState] = useState<VerificationState>(token ? 'verifying' : 'invalid');
  const [message, setMessage] = useState(
    token ? 'Confirming your verification link…' : 'This verification link is missing or invalid.',
  );
  const verificationStarted = useRef(false);

  useEffect(() => {
    if (location.hash) {
      void navigate('/verify-email', { replace: true });
    }
  }, [location.hash, navigate]);

  useEffect(() => {
    if (!token || verificationStarted.current) {
      return;
    }

    verificationStarted.current = true;

    void authService
      .verifyEmail(token)
      .then(async () => {
        if (authStatus === 'authenticated') {
          await refreshCurrentUser();
        }

        setState('verified');
        setMessage('Your email is verified. Document uploads and AI features are now available.');
      })
      .catch((error: unknown) => {
        setState('invalid');
        setMessage(
          error instanceof ApiClientError
            ? error.message
            : 'This verification link is invalid or has expired.',
        );
      });
  }, [authStatus, refreshCurrentUser, token]);

  const Icon = state === 'verified' ? CircleCheck : state === 'invalid' ? CircleX : LoaderCircle;

  return (
    <Card className="p-6 text-center sm:p-8" variant="glass">
      <span
        className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary"
        aria-hidden="true"
      >
        <Icon
          className={
            state === 'verifying' ? 'size-7 animate-soft-spin motion-reduce:animate-none' : 'size-7'
          }
        />
      </span>
      <h1 className="mt-5 type-heading-1 font-semibold text-foreground">Email verification</h1>
      <p className="mt-3 type-body-large text-muted" role="status">
        {message}
      </p>
      {state !== 'verifying' ? (
        <Button
          className="mt-6"
          onClick={() => void navigate(authStatus === 'authenticated' ? '/dashboard' : '/login')}
          size="large"
        >
          {authStatus === 'authenticated' ? 'Continue to workspace' : 'Go to sign in'}
        </Button>
      ) : null}
    </Card>
  );
}
