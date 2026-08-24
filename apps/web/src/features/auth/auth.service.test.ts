import type { AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient, clearCsrfToken } from '../../lib/api-client';
import {
  getCurrentUser,
  login,
  logout,
  register,
  resendVerification,
  verifyEmail,
} from './auth.service';

const publicUser = {
  id: 'cm123456789',
  email: 'developer@example.com',
  emailVerified: true,
  name: null,
  createdAt: '2026-07-29T08:30:00.000Z',
};

function responseWith(data: unknown): AxiosResponse<unknown> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: {} },
  } as AxiosResponse<unknown>;
}

afterEach(() => {
  clearCsrfToken();
  vi.restoreAllMocks();
});

describe('authentication service', () => {
  it('logs in with the backend credentials contract and maps the public user', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(responseWith({ user: publicUser }));
    const get = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValue(responseWith({ data: { csrfToken: 'session-bound-token' } }));

    await expect(
      login({ email: ' Developer@Example.com ', password: 'password123' }),
    ).resolves.toEqual(publicUser);
    expect(post).toHaveBeenCalledWith('/api/auth/login', {
      email: 'developer@example.com',
      password: 'password123',
    });
    expect(get).toHaveBeenCalledWith('/api/auth/csrf-token');
  });

  it('registers with only email and password using the actual endpoint', async () => {
    const registrationResponse = { data: { status: 'VERIFICATION_REQUIRED' as const } };
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(responseWith(registrationResponse));

    await expect(register({ email: publicUser.email, password: 'password123' })).resolves.toEqual(
      registrationResponse,
    );
    expect(post).toHaveBeenCalledWith('/api/auth/register', {
      email: publicUser.email,
      password: 'password123',
    });
  });

  it('calls the backend logout endpoint', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(responseWith(undefined));

    await logout();

    expect(post).toHaveBeenCalledWith('/api/auth/logout');
  });

  it('submits only the verification token and maps the safe result', async () => {
    const post = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue(responseWith({ data: { status: 'VERIFIED' } }));

    await expect(verifyEmail('a'.repeat(43))).resolves.toBe('VERIFIED');
    expect(post).toHaveBeenCalledWith('/api/auth/verify-email', { token: 'a'.repeat(43) });
  });

  it('requests authenticated resend without account identifiers', async () => {
    const post = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue(responseWith({ data: { status: 'VERIFICATION_SENT' } }));

    await expect(resendVerification()).resolves.toBe('VERIFICATION_SENT');
    expect(post).toHaveBeenCalledWith('/api/auth/resend-verification');
  });

  it('loads and validates the current public user', async () => {
    const get = vi
      .spyOn(apiClient, 'get')
      .mockImplementation(async (path: string) =>
        responseWith(
          path === '/api/auth/me'
            ? { user: publicUser }
            : { data: { csrfToken: 'session-bound-token' } },
        ),
      );

    await expect(getCurrentUser()).resolves.toEqual(publicUser);
    expect(get).toHaveBeenCalledWith('/api/auth/me');
    expect(get).toHaveBeenCalledWith('/api/auth/csrf-token');
  });

  it('rejects a response that does not match the public user contract', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      responseWith({
        user: {
          ...publicUser,
          id: null,
          passwordHash: 'must-never-be-consumed',
        },
      }),
    );

    await expect(getCurrentUser()).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
      kind: 'unexpected',
    });
  });
});
