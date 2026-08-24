import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../../lib/api-client';
import * as authService from './auth.service';
import { resetAuthStore, useAuthStore } from './auth.store';

vi.mock('./auth.service', () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  resendVerification: vi.fn(),
  verifyEmail: vi.fn(),
}));

const publicUser = {
  id: 'cm123456789',
  email: 'developer@example.com',
  emailVerified: true,
  name: null,
  createdAt: '2026-07-29T08:30:00.000Z',
};

const unauthenticatedError = new ApiClientError({
  code: 'UNAUTHENTICATED',
  kind: 'unauthenticated',
  message: 'Your session has expired. Sign in to continue.',
  status: 401,
});

beforeEach(() => {
  resetAuthStore();
  vi.clearAllMocks();
});

describe('authentication store', () => {
  it('restores the user after a successful authentication check', async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue(publicUser);

    await useAuthStore.getState().checkAuth();

    expect(useAuthStore.getState()).toMatchObject({
      user: publicUser,
      status: 'authenticated',
      error: null,
    });
  });

  it('clears the user when the current session is unauthenticated', async () => {
    useAuthStore.setState({ user: publicUser });
    vi.mocked(authService.getCurrentUser).mockRejectedValue(unauthenticatedError);

    await useAuthStore.getState().checkAuth();

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      status: 'unauthenticated',
      error: null,
    });
  });

  it('keeps connection failure distinct and recoverable', async () => {
    vi.mocked(authService.getCurrentUser).mockRejectedValue(
      new ApiClientError({
        code: 'NETWORK_ERROR',
        kind: 'network',
        message: 'Unable to connect.',
      }),
    );

    await useAuthStore.getState().checkAuth();

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      status: 'unavailable',
      error: { code: 'NETWORK_ERROR' },
    });
  });

  it('sets authenticated state after a successful login', async () => {
    vi.mocked(authService.login).mockResolvedValue(publicUser);

    await useAuthStore.getState().login({ email: publicUser.email, password: 'password123' });

    expect(useAuthStore.getState()).toMatchObject({
      user: publicUser,
      status: 'authenticated',
      operation: 'idle',
    });
  });

  it('exposes only the normalized safe login error', async () => {
    const error = new ApiClientError({
      code: 'INVALID_CREDENTIALS',
      kind: 'credentials',
      message: 'The email or password is incorrect.',
      status: 401,
    });
    vi.mocked(authService.login).mockRejectedValue(error);

    await expect(
      useAuthStore.getState().login({ email: publicUser.email, password: 'wrongpass' }),
    ).rejects.toBe(error);

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      status: 'unauthenticated',
      error: { code: 'INVALID_CREDENTIALS' },
    });
  });

  it('does not create a session after registration because the backend does not', async () => {
    const registrationResponse = { data: { status: 'VERIFICATION_REQUIRED' as const } };
    vi.mocked(authService.register).mockResolvedValue(registrationResponse);

    await expect(
      useAuthStore.getState().register({
        email: publicUser.email,
        password: 'password123',
      }),
    ).resolves.toEqual(registrationResponse);

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      status: 'unauthenticated',
      operation: 'idle',
    });
  });

  it('refreshes authoritative verification state without requiring a new login', async () => {
    const verifiedUser = { ...publicUser, emailVerified: true };
    useAuthStore.setState({
      user: { ...publicUser, emailVerified: false },
      status: 'authenticated',
    });
    vi.mocked(authService.getCurrentUser).mockResolvedValue(verifiedUser);

    await useAuthStore.getState().refreshCurrentUser();

    expect(useAuthStore.getState()).toMatchObject({
      user: verifiedUser,
      status: 'authenticated',
    });
  });

  it('resends verification while keeping the authenticated session', async () => {
    useAuthStore.setState({
      user: { ...publicUser, emailVerified: false },
      status: 'authenticated',
    });
    vi.mocked(authService.resendVerification).mockResolvedValue('VERIFICATION_SENT');

    await expect(useAuthStore.getState().resendVerification()).resolves.toBe('VERIFICATION_SENT');
    expect(useAuthStore.getState()).toMatchObject({
      user: { emailVerified: false },
      status: 'authenticated',
      operation: 'idle',
    });
  });

  it('clears local auth state when logout reports an already invalid session', async () => {
    useAuthStore.setState({ user: publicUser, status: 'authenticated' });
    vi.mocked(authService.logout).mockRejectedValue(unauthenticatedError);

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      status: 'unauthenticated',
      operation: 'idle',
      error: null,
    });
  });
});
