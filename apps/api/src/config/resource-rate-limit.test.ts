import assert from 'node:assert/strict';
import test from 'node:test';

import { RESOURCE_RATE_LIMIT_POLICIES } from './resource-rate-limit.js';

test('centralizes the approved upload and AI IP limits', () => {
  assert.deepEqual(RESOURCE_RATE_LIMIT_POLICIES.uploadIp, {
    name: 'upload-ip',
    limit: 20,
    windowSeconds: 3_600,
  });
  assert.deepEqual(RESOURCE_RATE_LIMIT_POLICIES.aiIp, {
    name: 'ai-ip',
    limit: 60,
    windowSeconds: 3_600,
  });
});
