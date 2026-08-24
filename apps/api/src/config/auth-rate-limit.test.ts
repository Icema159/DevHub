import assert from 'node:assert/strict';
import test from 'node:test';

import { AUTH_RATE_LIMIT_POLICIES } from './auth-rate-limit.js';

test('centralizes the approved portfolio-demo authentication limits', () => {
  assert.deepEqual(AUTH_RATE_LIMIT_POLICIES, {
    registrationIp: { name: 'registration-ip', limit: 5, windowSeconds: 3_600 },
    loginIp: { name: 'login-ip', limit: 30, windowSeconds: 900 },
    loginIdentity: { name: 'login-identity', limit: 10, windowSeconds: 900 },
    resendUser: { name: 'verification-resend-user', limit: 3, windowSeconds: 3_600 },
    resendIp: { name: 'verification-resend-ip', limit: 5, windowSeconds: 3_600 },
    verificationIp: { name: 'verification-submit-ip', limit: 20, windowSeconds: 3_600 },
  });
});
