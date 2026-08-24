import axios, { AxiosError, type AxiosInstance } from 'axios';

import { resolveApiBaseUrl } from './api-base-url';
import { notifyUnauthorized } from './auth-events';

export type ApiErrorKind =
  | 'unauthenticated'
  | 'forbidden'
  | 'rate-limited'
  | 'validation'
  | 'credentials'
  | 'conflict'
  | 'network'
  | 'server'
  | 'unexpected';

export interface PublicApiError {
  error: {
    code: string;
    message: string;
  };
}

interface ApiClientOptions {
  csrfToken?: () => string | null;
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PUBLIC_AUTH_MUTATIONS = new Set([
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/verify-email',
]);
let csrfToken: string | null = null;

export class ApiClientError extends Error {
  readonly code: string;
  readonly kind: ApiErrorKind;
  readonly status: number | null;

  constructor(options: {
    code: string;
    kind: ApiErrorKind;
    message: string;
    status?: number | null;
  }) {
    super(options.message);
    this.name = 'ApiClientError';
    this.code = options.code;
    this.kind = options.kind;
    this.status = options.status ?? null;
  }
}

const publicErrorMessages: Readonly<Record<string, string>> = Object.freeze({
  AUTH_PROTECTION_UNAVAILABLE: 'Authentication is temporarily unavailable. Try again later.',
  EMAIL_VERIFICATION_REQUIRED: 'Verify your email before uploading documents or using AI features.',
  INVALID_CREDENTIALS: 'The email or password is incorrect.',
  INVALID_OR_EXPIRED_VERIFICATION: 'This verification link is invalid or has expired.',
  INVALID_INPUT: 'Check the information you entered and try again.',
  RATE_LIMITED: 'Too many attempts. Wait a moment and try again.',
  RESOURCE_RATE_LIMITED: 'Too many requests. Wait a moment and try again.',
  RESOURCE_PROTECTION_UNAVAILABLE: 'Resource protection is temporarily unavailable. Try again.',
  AI_DAILY_LIMIT_REACHED: "You've reached today's AI usage limit. Try again later.",
  AI_TEMPORARILY_UNAVAILABLE: 'AI features are temporarily unavailable. Try again later.',
  UNAUTHENTICATED: 'Your session has expired. Sign in to continue.',
  VERIFICATION_EMAIL_UNAVAILABLE: 'Verification email could not be sent. Try again later.',
});

function isPublicApiError(value: unknown): value is PublicApiError {
  if (!value || typeof value !== 'object' || !('error' in value)) {
    return false;
  }

  const error = value.error;

  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

function kindForResponse(status: number, code: string | undefined): ApiErrorKind {
  if (code === 'UNAUTHENTICATED') {
    return 'unauthenticated';
  }

  if (code === 'INVALID_CREDENTIALS') {
    return 'credentials';
  }

  if (code === 'EMAIL_VERIFICATION_REQUIRED' || status === 403) {
    return 'forbidden';
  }

  if (code === 'RATE_LIMITED' || code === 'RESOURCE_RATE_LIMITED' || status === 429) {
    return 'rate-limited';
  }

  if (status === 400 || code === 'INVALID_INPUT') {
    return 'validation';
  }

  if (status === 409) {
    return 'conflict';
  }

  if (status >= 500) {
    return 'server';
  }

  return 'unexpected';
}

function messageForResponse(status: number, code: string | undefined): string {
  if (code && publicErrorMessages[code]) {
    return publicErrorMessages[code];
  }

  if (status === 400) {
    return 'Check the information you entered and try again.';
  }

  if (status === 401) {
    return 'Authentication is required.';
  }

  if (status === 403) {
    return 'This action is not available for your account.';
  }

  if (status === 429) {
    return 'Too many attempts. Wait a moment and try again.';
  }

  if (status === 409) {
    return 'The request conflicts with existing information.';
  }

  if (status >= 500) {
    return 'The service is temporarily unavailable. Try again later.';
  }

  return 'The request could not be completed.';
}

export function normalizeApiError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) {
    return error;
  }

  if (error instanceof AxiosError || axios.isAxiosError(error)) {
    if (!error.response) {
      return new ApiClientError({
        code: 'NETWORK_ERROR',
        kind: 'network',
        message: 'Unable to connect to the service. Check your connection and try again.',
      });
    }

    const status = error.response.status;
    const publicError = isPublicApiError(error.response.data) ? error.response.data.error : null;
    const code = publicError?.code ?? `HTTP_${status}`;

    return new ApiClientError({
      code,
      kind: kindForResponse(status, publicError?.code),
      message: messageForResponse(status, publicError?.code),
      status,
    });
  }

  return new ApiClientError({
    code: 'UNEXPECTED_ERROR',
    kind: 'unexpected',
    message: 'Something went wrong. Try again.',
  });
}

function normalizedRequestPath(url: string | undefined): string {
  if (!url) {
    return '';
  }

  try {
    return new URL(url, 'http://local.invalid').pathname;
  } catch {
    return url.split('?')[0] ?? '';
  }
}

export function createApiClient(
  baseURL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL, import.meta.env.PROD),
  options: ApiClientOptions = {},
): AxiosInstance {
  const client = axios.create({
    baseURL,
    headers: {
      Accept: 'application/json',
    },
    timeout: 15_000,
    withCredentials: true,
  });

  client.interceptors.request.use((configuration) => {
    const method = configuration.method?.toUpperCase() ?? 'GET';
    const path = normalizedRequestPath(configuration.url);
    const currentCsrfToken = (options.csrfToken ?? (() => csrfToken))();

    if (UNSAFE_METHODS.has(method) && !PUBLIC_AUTH_MUTATIONS.has(path) && currentCsrfToken) {
      configuration.headers.set('X-CSRF-Token', currentCsrfToken);
    }

    return configuration;
  });

  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      const normalizedError = normalizeApiError(error);

      if (normalizedError.kind === 'unauthenticated') {
        clearCsrfToken();
        notifyUnauthorized();
      }

      return Promise.reject(normalizedError);
    },
  );

  return client;
}

export const apiClient = createApiClient();

function isCsrfTokenResponse(value: unknown): value is { data: { csrfToken: string } } {
  if (!value || typeof value !== 'object' || !('data' in value)) {
    return false;
  }

  const data = value.data;

  return (
    typeof data === 'object' &&
    data !== null &&
    'csrfToken' in data &&
    typeof data.csrfToken === 'string' &&
    data.csrfToken.length > 0
  );
}

export async function initializeCsrfToken(): Promise<void> {
  const response = await apiClient.get<unknown>('/api/auth/csrf-token');

  if (!isCsrfTokenResponse(response.data)) {
    throw new ApiClientError({
      code: 'INVALID_API_RESPONSE',
      kind: 'unexpected',
      message: 'The service returned an unexpected response. Try again.',
    });
  }

  csrfToken = response.data.data.csrfToken;
}

export function clearCsrfToken(): void {
  csrfToken = null;
}
