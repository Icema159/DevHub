import assert from 'node:assert/strict';
import test from 'node:test';

import { hasAutomaticAttemptsRemaining, type JobAttemptState } from './job-attempts.js';

function attemptState(attemptsMade: number, attempts?: number): JobAttemptState {
  return {
    attemptsMade,
    opts: attempts === undefined ? {} : { attempts },
  };
}

test('reports remaining automatic attempts before BullMQ records the current failure', () => {
  assert.equal(hasAutomaticAttemptsRemaining(attemptState(0, 3)), true);
  assert.equal(hasAutomaticAttemptsRemaining(attemptState(1, 3)), true);
  assert.equal(hasAutomaticAttemptsRemaining(attemptState(2, 3)), false);
});

test('treats one or unspecified attempt as final on the first failure', () => {
  assert.equal(hasAutomaticAttemptsRemaining(attemptState(0, 1)), false);
  assert.equal(hasAutomaticAttemptsRemaining(attemptState(0)), false);
});
