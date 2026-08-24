import assert from 'node:assert/strict';
import test from 'node:test';

import { createRedisConnectionOptions } from './redis-connection.js';

test('Redis connection is dual-stack compatible and preserves URL options', () => {
  assert.deepEqual(createRedisConnectionOptions('redis://user:secret@redis.internal:6380/4', 1), {
    host: 'redis.internal',
    port: 6380,
    family: 0,
    db: 4,
    maxRetriesPerRequest: 1,
    username: 'user',
    password: 'secret',
  });
});

test('rediss enables TLS while worker retry configuration remains configurable', () => {
  assert.deepEqual(createRedisConnectionOptions('rediss://redis.internal', null), {
    host: 'redis.internal',
    port: 6379,
    family: 0,
    db: 0,
    maxRetriesPerRequest: null,
    tls: {},
  });
});
