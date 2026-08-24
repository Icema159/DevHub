import assert from 'node:assert/strict';
import test from 'node:test';

import { AUTH_RATE_LIMIT_POLICIES } from '../config/auth-rate-limit.js';
import {
  createAuthRateLimitService,
  hashRateLimitSubject,
  type AuthRateLimitStore,
} from './auth-rate-limit.service.js';

test('uses opaque centralized keys and enforces the configured fixed-window count', async () => {
  const calls: Array<{ key: string; windowSeconds: number }> = [];
  let count = 0;
  const store: AuthRateLimitStore = {
    async consume(key, windowSeconds) {
      calls.push({ key, windowSeconds });
      count += 1;
      return { count, retryAfterSeconds: windowSeconds };
    },
  };
  const service = createAuthRateLimitService(store, 'test-auth');
  const subject = 'Developer@Example.com';

  for (let attempt = 1; attempt <= AUTH_RATE_LIMIT_POLICIES.registrationIp.limit; attempt += 1) {
    assert.equal(
      (await service.consume(AUTH_RATE_LIMIT_POLICIES.registrationIp, subject)).allowed,
      true,
    );
  }

  const rejected = await service.consume(AUTH_RATE_LIMIT_POLICIES.registrationIp, subject);
  assert.equal(rejected.allowed, false);
  assert.equal(calls[0]?.windowSeconds, 3_600);
  assert.equal(calls[0]?.key.includes(subject), false);
  assert.equal(calls[0]?.key.endsWith(hashRateLimitSubject(subject)), true);
});

test('reset removes only the exact scoped limiter key', async () => {
  const deleted: string[] = [];
  const store: AuthRateLimitStore = {
    async consume() {
      return { count: 1, retryAfterSeconds: 10 };
    },
    async delete(key) {
      deleted.push(key);
    },
  };
  const service = createAuthRateLimitService(store, 'isolated-test');

  await service.reset(AUTH_RATE_LIMIT_POLICIES.loginIdentity, 'user@example.com');

  assert.deepEqual(deleted, [
    `isolated-test:login-identity:${hashRateLimitSubject('user@example.com')}`,
  ]);
});
