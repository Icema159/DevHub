export interface CurrentUser {
  createdAt: string;
  email: string;
  emailVerified: boolean;
  id: string;
  name: string | null;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: CurrentUser;
}

export interface RegistrationResponse {
  data: {
    status: 'VERIFICATION_REQUIRED';
  };
}

export type VerificationActionStatus = 'VERIFIED' | 'VERIFICATION_SENT' | 'ALREADY_VERIFIED';

export type AuthStatus = 'idle' | 'checking' | 'authenticated' | 'unauthenticated' | 'unavailable';

export type AuthOperation = 'idle' | 'login' | 'register' | 'logout' | 'resend-verification';
