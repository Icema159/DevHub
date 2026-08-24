import { create } from 'zustand';

import { ApiClientError, normalizeApiError } from '../../lib/api-client';
import * as authService from './auth.service';
import type {
  AuthCredentials,
  AuthOperation,
  AuthStatus,
  CurrentUser,
  RegistrationResponse,
  VerificationActionStatus,
} from './auth.types';

interface AuthState {
  clearError: () => void;
  checkAuth: () => Promise<void>;
  error: ApiClientError | null;
  expireSession: () => void;
  login: (credentials: AuthCredentials) => Promise<void>;
  logout: () => Promise<void>;
  operation: AuthOperation;
  refreshCurrentUser: () => Promise<void>;
  register: (credentials: AuthCredentials) => Promise<RegistrationResponse>;
  resendVerification: () => Promise<VerificationActionStatus>;
  status: AuthStatus;
  user: CurrentUser | null;
}

let pendingAuthCheck: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  operation: 'idle',
  error: null,

  clearError: () => {
    set({ error: null });
  },

  expireSession: () => {
    set({
      user: null,
      status: 'unauthenticated',
      operation: 'idle',
      error: new ApiClientError({
        code: 'UNAUTHENTICATED',
        kind: 'unauthenticated',
        message: 'Your session has expired. Sign in to continue.',
        status: 401,
      }),
    });
  },

  checkAuth: async () => {
    if (pendingAuthCheck) {
      return pendingAuthCheck;
    }

    set({ status: 'checking', error: null });

    pendingAuthCheck = (async () => {
      try {
        const user = await authService.getCurrentUser();
        set({ user, status: 'authenticated', error: null });
      } catch (error) {
        const normalizedError = normalizeApiError(error);

        if (normalizedError.kind === 'unauthenticated') {
          set({ user: null, status: 'unauthenticated', error: null });
          return;
        }

        set({
          user: null,
          status: 'unavailable',
          error: normalizedError,
        });
      } finally {
        pendingAuthCheck = null;
      }
    })();

    return pendingAuthCheck;
  },

  login: async (credentials) => {
    set({ operation: 'login', error: null });

    try {
      const user = await authService.login(credentials);
      set({ user, status: 'authenticated', error: null });
    } catch (error) {
      const normalizedError = normalizeApiError(error);
      set({ user: null, status: 'unauthenticated', error: normalizedError });
      throw normalizedError;
    } finally {
      set({ operation: 'idle' });
    }
  },

  register: async (credentials) => {
    set({ operation: 'register', error: null });

    try {
      const result = await authService.register(credentials);
      set({ user: null, status: 'unauthenticated', error: null });
      return result;
    } catch (error) {
      const normalizedError = normalizeApiError(error);
      set({ error: normalizedError });
      throw normalizedError;
    } finally {
      set({ operation: 'idle' });
    }
  },

  refreshCurrentUser: async () => {
    const user = await authService.getCurrentUser();
    set({ user, status: 'authenticated', error: null });
  },

  resendVerification: async () => {
    set({ operation: 'resend-verification', error: null });

    try {
      const result = await authService.resendVerification();
      set({ error: null });
      return result;
    } catch (error) {
      const normalizedError = normalizeApiError(error);
      set({ error: normalizedError });
      throw normalizedError;
    } finally {
      set({ operation: 'idle' });
    }
  },

  logout: async () => {
    set({ operation: 'logout', error: null });

    try {
      await authService.logout();
    } catch {
      // Local session state still clears when the server already considers
      // the cookie invalid or a logout response cannot be delivered.
    } finally {
      set({
        user: null,
        status: 'unauthenticated',
        operation: 'idle',
        error: null,
      });
    }
  },
}));

export function resetAuthStore(): void {
  pendingAuthCheck = null;
  useAuthStore.setState({
    user: null,
    status: 'idle',
    operation: 'idle',
    error: null,
  });
}
