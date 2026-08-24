import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../utils/app-error.js';
import { requireVerifiedEmail } from './require-verified-email.js';

function run(emailVerified: boolean): unknown {
  let result: unknown;
  const request = {
    user: {
      sessionId: 'session-a',
      userId: 'user-a',
      email: 'user-a@example.com',
      emailVerified,
    },
  } as Request;
  const next: NextFunction = (error?: unknown) => {
    result = error;
  };

  requireVerifiedEmail(request, {} as Response, next);
  return result;
}

test('allows a database-authoritative verified user', () => {
  assert.equal(run(true), undefined);
});

test('blocks an unverified user with the stable capability error', () => {
  const error = run(false);

  assert.ok(error instanceof AppError);
  assert.equal(error.statusCode, 403);
  assert.equal(error.code, 'EMAIL_VERIFICATION_REQUIRED');
});
