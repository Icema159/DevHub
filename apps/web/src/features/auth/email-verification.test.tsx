import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as authService from './auth.service';
import { resetAuthStore, useAuthStore } from './auth.store';
import { EmailVerificationNotice } from './components/EmailVerificationNotice';
import { VerifyEmailPage } from './pages/VerifyEmailPage';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.hash}`}</output>;
}

beforeEach(() => {
  resetAuthStore();
  vi.restoreAllMocks();
});

describe('email verification UX', () => {
  it('consumes the fragment token, removes it from the URL, and refreshes current user state', async () => {
    const token = 'a'.repeat(43);
    const refreshCurrentUser = vi.fn(async () => undefined);
    vi.spyOn(authService, 'verifyEmail').mockResolvedValue('VERIFIED');
    useAuthStore.setState({ status: 'authenticated', refreshCurrentUser });

    render(
      <MemoryRouter initialEntries={[`/verify-email#token=${token}`]}>
        <VerifyEmailPage />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Your email is verified/)).toBeInTheDocument();
    expect(authService.verifyEmail).toHaveBeenCalledWith(token);
    expect(refreshCurrentUser).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/verify-email'));
    expect(screen.getByTestId('location')).not.toHaveTextContent('token=');
  });

  it('shows a safe result for a missing verification token', () => {
    render(
      <MemoryRouter initialEntries={['/verify-email']}>
        <VerifyEmailPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('missing or invalid');
  });

  it('lets an authenticated unverified user request a new link', async () => {
    const user = userEvent.setup();
    const resendVerification = vi.fn(async () => 'VERIFICATION_SENT' as const);
    useAuthStore.setState({ resendVerification });

    render(<EmailVerificationNotice />);
    await user.click(screen.getByRole('button', { name: 'Resend verification' }));

    expect(resendVerification).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/new verification link has been sent/i)).toBeInTheDocument();
  });
});
