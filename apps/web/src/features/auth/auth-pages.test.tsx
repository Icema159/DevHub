import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '../../components/ui';
import { AppRoutes } from '../../app/router';
import { ApiClientError } from '../../lib/api-client';
import { resetAuthStore, useAuthStore } from './auth.store';

function renderRoute(path: '/login' | '/register') {
  useAuthStore.setState({ status: 'unauthenticated' });

  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetAuthStore();
});

describe('authentication pages', () => {
  it('renders and validates the login form before submission', async () => {
    const user = userEvent.setup();
    const login = vi.fn();
    useAuthStore.setState({ login });
    renderRoute('/login');

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByLabelText(/Email address/)).toHaveAccessibleDescription(
      'Enter your email address.',
    );
    expect(screen.getByLabelText(/Password/)).toHaveAccessibleDescription('Enter your password.');
    expect(login).not.toHaveBeenCalled();
  });

  it('renders only the registration fields supported by the backend', () => {
    renderRoute('/register');

    expect(screen.getByLabelText(/Email address/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
  });

  it('disables registration inputs and submission while a request is pending', () => {
    renderRoute('/register');
    act(() => {
      useAuthStore.setState({ operation: 'register' });
    });

    expect(screen.getByLabelText(/Email address/)).toBeDisabled();
    expect(screen.getByLabelText(/Password/)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Creating account…' })).toBeDisabled();
  });

  it('shows a safe registration service error', () => {
    renderRoute('/register');
    act(() => {
      useAuthStore.setState({
        error: new ApiClientError({
          code: 'AUTH_PROTECTION_UNAVAILABLE',
          kind: 'server',
          message: 'Authentication is temporarily unavailable. Try again later.',
          status: 503,
        }),
      });
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Authentication is temporarily unavailable. Try again later.',
    );
  });

  it('returns a newly registered user to Login because registration creates no session', async () => {
    const user = userEvent.setup();
    const register = vi.fn(async () => ({
      data: { status: 'VERIFICATION_REQUIRED' as const },
    }));
    useAuthStore.setState({ register });
    renderRoute('/register');

    await user.type(screen.getByLabelText(/Email address/), 'new.developer@example.com');
    await user.type(screen.getByLabelText(/Password/), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Welcome back' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Check your inbox');
    expect(screen.getByLabelText(/Email address/)).toHaveValue('new.developer@example.com');
  });

  it('renders email-based initials when the authenticated user has no name', () => {
    useAuthStore.setState({
      user: {
        id: 'cm123456789',
        email: 'marius.smith@example.com',
        emailVerified: true,
        name: null,
        createdAt: '2026-07-29T08:30:00.000Z',
      },
      status: 'authenticated',
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(screen.getAllByText('MS').length).toBeGreaterThan(0);
    expect(screen.getAllByText('marius.smith@example.com').length).toBeGreaterThan(0);
  });
});
