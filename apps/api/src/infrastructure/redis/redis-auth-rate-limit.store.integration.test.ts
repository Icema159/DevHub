import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { AUTH_RATE_LIMIT_POLICIES } from '../../config/auth-rate-limit.js';
import { env } from '../../config/env.js';
import { createAuthRateLimitService } from '../../services/auth-rate-limit.service.js';
import { RedisAuthRateLimitStore } from './redis-auth-rate-limit.store.js';

test('Redis fixed-window limiter shares count, TTL, and targeted reset state', async () => {
  const store = new RedisAuthRateLimitStore(env.redisUrl);
  const service = createAuthRateLimitService(store, `test-auth-rate-limit:${randomUUID()}`);

  try {
    const first = await service.consume(AUTH_RATE_LIMIT_POLICIES.loginIdentity, 'user@example.com');
    const second = await service.consume(
      AUTH_RATE_LIMIT_POLICIES.loginIdentity,
      'user@example.com',
    );

    assert.equal(first.count, 1);
    assert.equal(second.count, 2);
    assert.ok(first.retryAfterSeconds > 0);
    assert.ok(first.retryAfterSeconds <= AUTH_RATE_LIMIT_POLICIES.loginIdentity.windowSeconds);

    await service.reset(AUTH_RATE_LIMIT_POLICIES.loginIdentity, 'user@example.com');

    const afterReset = await service.consume(
      AUTH_RATE_LIMIT_POLICIES.loginIdentity,
      'user@example.com',
    );
    assert.equal(afterReset.count, 1);
  } finally {
    await service.reset(AUTH_RATE_LIMIT_POLICIES.loginIdentity, 'user@example.com');
    await service.close();
  }
});
