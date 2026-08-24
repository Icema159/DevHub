import { useState } from 'react';

import { Alert, Button } from '../../../components/ui';
import { ApiClientError } from '../../../lib/api-client';
import { useAuthStore } from '../auth.store';

export function EmailVerificationNotice() {
  const operation = useAuthStore((state) => state.operation);
  const resendVerification = useAuthStore((state) => state.resendVerification);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackIsError, setFeedbackIsError] = useState(false);

  const handleResend = async () => {
    setFeedback(null);
    setFeedbackIsError(false);

    try {
      const status = await resendVerification();
      setFeedback(
        status === 'ALREADY_VERIFIED'
          ? 'Your email is already verified. Refresh the page if this notice remains.'
          : 'A new verification link has been sent. It expires in 60 minutes.',
      );
    } catch (error) {
      setFeedbackIsError(true);
      setFeedback(
        error instanceof ApiClientError
          ? error.message
          : 'The verification email could not be sent. Try again later.',
      );
    }
  };

  return (
    <Alert title="Verify your email" variant="warning">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p>Your email must be verified before uploading documents or using AI features.</p>
          {feedback ? (
            <p className={feedbackIsError ? 'mt-1 font-medium text-danger' : 'mt-1 font-medium'}>
              {feedback}
            </p>
          ) : null}
        </div>
        <Button
          className="shrink-0"
          isLoading={operation === 'resend-verification'}
          loadingLabel="Sending…"
          onClick={() => void handleResend()}
          size="small"
          variant="secondary"
        >
          Resend verification
        </Button>
      </div>
    </Alert>
  );
}
