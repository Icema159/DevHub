export interface AuthRateLimitPolicy {
  limit: number;
  name: string;
  windowSeconds: number;
}

export const AUTH_RATE_LIMIT_POLICIES = Object.freeze({
  registrationIp: {
    name: 'registration-ip',
    limit: 5,
    windowSeconds: 60 * 60,
  },
  loginIp: {
    name: 'login-ip',
    limit: 30,
    windowSeconds: 15 * 60,
  },
  loginIdentity: {
    name: 'login-identity',
    limit: 10,
    windowSeconds: 15 * 60,
  },
  resendUser: {
    name: 'verification-resend-user',
    limit: 3,
    windowSeconds: 60 * 60,
  },
  resendIp: {
    name: 'verification-resend-ip',
    limit: 5,
    windowSeconds: 60 * 60,
  },
  verificationIp: {
    name: 'verification-submit-ip',
    limit: 20,
    windowSeconds: 60 * 60,
  },
} as const satisfies Record<string, AuthRateLimitPolicy>);
