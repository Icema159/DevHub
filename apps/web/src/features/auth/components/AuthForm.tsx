import { LockKeyhole, Mail } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';

import { Alert, Button, Input } from '../../../components/ui';
import { validateAuthCredentials, type AuthFieldErrors } from '../auth.schemas';
import type { AuthCredentials } from '../auth.types';

export interface AuthFormProps {
  alternateAction: ReactNode;
  defaultEmail?: string;
  error?: string;
  isSubmitting: boolean;
  mode: 'login' | 'register';
  onChange?: () => void;
  onSubmit: (credentials: AuthCredentials) => Promise<void>;
  successMessage?: string;
}

export function AuthForm({
  alternateAction,
  defaultEmail = '',
  error,
  isSubmitting,
  mode,
  onChange,
  onSubmit,
  successMessage,
}: AuthFormProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const isLogin = mode === 'login';

  const updateEmail = (value: string) => {
    setEmail(value);
    setFieldErrors((current) => {
      const { email: _email, ...remainingErrors } = current;
      void _email;
      return remainingErrors;
    });
    onChange?.();
  };

  const updatePassword = (value: string) => {
    setPassword(value);
    setFieldErrors((current) => {
      const { password: _password, ...remainingErrors } = current;
      void _password;
      return remainingErrors;
    });
    onChange?.();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const result = validateAuthCredentials({ email, password });

    if (!result.success) {
      setFieldErrors(result.errors);
      return;
    }

    setFieldErrors({});
    await onSubmit(result.data);
  };

  return (
    <form className="grid gap-5" noValidate onSubmit={handleSubmit}>
      {successMessage ? (
        <Alert title="Account created" variant="success">
          {successMessage}
        </Alert>
      ) : null}

      {error ? (
        <Alert title={isLogin ? 'Unable to sign in' : 'Unable to create account'} variant="error">
          {error}
        </Alert>
      ) : null}

      <Input
        autoComplete="email"
        autoFocus
        disabled={isSubmitting}
        inputMode="email"
        label="Email address"
        leadingIcon={<Mail className="size-4" />}
        onChange={(event) => updateEmail(event.target.value)}
        placeholder="you@example.com"
        required
        type="email"
        value={email}
        {...(fieldErrors.email ? { error: fieldErrors.email } : {})}
      />

      <Input
        autoComplete={isLogin ? 'current-password' : 'new-password'}
        disabled={isSubmitting}
        label="Password"
        leadingIcon={<LockKeyhole className="size-4" />}
        onChange={(event) => updatePassword(event.target.value)}
        placeholder={isLogin ? 'Enter your password' : 'Create a password'}
        required
        type="password"
        value={password}
        {...(fieldErrors.password ? { error: fieldErrors.password } : {})}
        {...(!isLogin
          ? { helperText: 'Use at least 8 characters and no more than 72 UTF-8 bytes.' }
          : {})}
      />

      <Button
        className="mt-1 w-full"
        isLoading={isSubmitting}
        loadingLabel={isLogin ? 'Signing in…' : 'Creating account…'}
        size="large"
        type="submit"
      >
        {isLogin ? 'Sign in' : 'Create account'}
      </Button>

      <div className="text-center type-body text-muted">{alternateAction}</div>
    </form>
  );
}
