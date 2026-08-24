import { describe, expect, it, vi } from 'vitest';

import { subscribeToUnauthorized } from './auth-events';
import { createApiClient, normalizeApiError } from './api-client';

describe('API client', () => {
  it('uses the configured base URL and includes credentials on requests', () => {
    const client = createApiClient('http://localhost:3000');

    expect(client.defaults.baseURL).toBe('http://localhost:3000');
    expect(client.defaults.withCredentials).toBe(true);
  });

  it('adds an in-memory CSRF token only to protected unsafe requests', async () => {
    const protectedAdapter = vi.fn(async (configuration) => ({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config: configuration,
    }));
    const client = createApiClient('http://localhost:3000', {
      csrfToken: () => 'session-bound-token',
    });

    await client.post('/api/conversations', undefined, { adapter: protectedAdapter });

    expect(protectedAdapter).toHaveBeenCalledOnce();
    expect(protectedAdapter.mock.calls[0]?.[0].headers.get('X-CSRF-Token')).toBe(
      'session-bound-token',
    );

    const publicAdapter = vi.fn(async (configuration) => ({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config: configuration,
    }));
    await client.post('/api/auth/login', {}, { adapter: publicAdapter });

    expect(publicAdapter.mock.calls[0]?.[0].headers.has('X-CSRF-Token')).toBe(false);
  });

  it('normalizes a public invalid-credentials response safely', () => {
    const error = normalizeApiError({
      isAxiosError: true,
      response: {
        status: 401,
        data: {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'A backend message that is not rendered directly',
          },
        },
      },
    });

    expect(error).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      kind: 'credentials',
      message: 'The email or password is incorrect.',
      status: 401,
    });
    expect(error.message).not.toContain('backend message');
  });

  it('distinguishes a connection failure from invalid authentication', () => {
    const error = normalizeApiError({
      isAxiosError: true,
      request: {},
    });

    expect(error).toMatchObject({
      code: 'NETWORK_ERROR',
      kind: 'network',
      status: null,
    });
    expect(error.message).toContain('connect');
  });

  it('does not expose an unexpected server response', () => {
    const error = normalizeApiError({
      isAxiosError: true,
      response: {
        status: 500,
        data: {
          stack: 'database credentials and internal stack trace',
        },
      },
    });

    expect(error.kind).toBe('server');
    expect(error.message).toBe('The service is temporarily unavailable. Try again later.');
    expect(error.message).not.toContain('database');
  });

  it('emits a session-expiration event for the public unauthenticated contract', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToUnauthorized(listener);
    const client = createApiClient('http://localhost:3000');

    try {
      await expect(
        client.get('/api/protected', {
          adapter: async () =>
            Promise.reject({
              isAxiosError: true,
              response: {
                status: 401,
                data: {
                  error: {
                    code: 'UNAUTHENTICATED',
                    message: 'Authentication is required',
                  },
                },
              },
            }),
        }),
      ).rejects.toMatchObject({
        code: 'UNAUTHENTICATED',
        kind: 'unauthenticated',
      });

      expect(listener).toHaveBeenCalledOnce();
    } finally {
      unsubscribe();
    }
  });

  it('keeps verification-required distinct from session expiration', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToUnauthorized(listener);
    const client = createApiClient('http://localhost:3000');

    try {
      await expect(
        client.post('/api/documents', undefined, {
          adapter: async () =>
            Promise.reject({
              isAxiosError: true,
              response: {
                status: 403,
                data: {
                  error: {
                    code: 'EMAIL_VERIFICATION_REQUIRED',
                    message: 'Backend text is not trusted directly',
                  },
                },
              },
            }),
        }),
      ).rejects.toMatchObject({
        code: 'EMAIL_VERIFICATION_REQUIRED',
        kind: 'forbidden',
        message: 'Verify your email before uploading documents or using AI features.',
      });
      expect(listener).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });
});
