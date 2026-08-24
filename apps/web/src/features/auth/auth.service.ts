import {
  apiClient,
  ApiClientError,
  clearCsrfToken,
  initializeCsrfToken,
} from '../../lib/api-client';
import {
  authCredentialsSchema,
  authResponseSchema,
  registrationResponseSchema,
  verificationActionResponseSchema,
} from './auth.schemas';
import type {
  AuthCredentials,
  CurrentUser,
  RegistrationResponse,
  VerificationActionStatus,
} from './auth.types';

function parseAuthResponse(value: unknown): CurrentUser {
  const result = authResponseSchema.safeParse(value);

  if (!result.success) {
    throw new ApiClientError({
      code: 'INVALID_API_RESPONSE',
      kind: 'unexpected',
      message: 'The service returned an unexpected response. Try again.',
    });
  }

  return result.data.user;
}

function parseCredentials(credentials: AuthCredentials): AuthCredentials {
  const result = authCredentialsSchema.safeParse(credentials);

  if (!result.success) {
    throw new ApiClientError({
      code: 'INVALID_INPUT',
      kind: 'validation',
      message: 'Check the information you entered and try again.',
      status: 400,
    });
  }

  return result.data;
}

export async function register(credentials: AuthCredentials): Promise<RegistrationResponse> {
  const response = await apiClient.post<unknown>(
    '/api/auth/register',
    parseCredentials(credentials),
  );
  const result = registrationResponseSchema.safeParse(response.data);

  if (!result.success) {
    throw new ApiClientError({
      code: 'INVALID_API_RESPONSE',
      kind: 'unexpected',
      message: 'The service returned an unexpected response. Try again.',
    });
  }

  return result.data;
}

export async function login(credentials: AuthCredentials): Promise<CurrentUser> {
  clearCsrfToken();
  const response = await apiClient.post<unknown>('/api/auth/login', parseCredentials(credentials));
  const user = parseAuthResponse(response.data);
  await initializeCsrfToken();

  return user;
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/api/auth/logout');
  } finally {
    clearCsrfToken();
  }
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const response = await apiClient.get<unknown>('/api/auth/me');
  const user = parseAuthResponse(response.data);
  await initializeCsrfToken();

  return user;
}

function parseVerificationActionResponse(value: unknown): VerificationActionStatus {
  const result = verificationActionResponseSchema.safeParse(value);

  if (!result.success) {
    throw new ApiClientError({
      code: 'INVALID_API_RESPONSE',
      kind: 'unexpected',
      message: 'The service returned an unexpected response. Try again.',
    });
  }

  return result.data.data.status;
}

export async function verifyEmail(token: string): Promise<VerificationActionStatus> {
  const response = await apiClient.post<unknown>('/api/auth/verify-email', { token });

  return parseVerificationActionResponse(response.data);
}

export async function resendVerification(): Promise<VerificationActionStatus> {
  const response = await apiClient.post<unknown>('/api/auth/resend-verification');

  return parseVerificationActionResponse(response.data);
}
