import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { AuthRateLimitPolicy } from '../config/auth-rate-limit.js';
import { AppError } from '../utils/app-error.js';
import { createAuthRateLimitMiddleware } from './auth-rate-limit.js';

async function runMiddleware(
  middleware: RequestHandler,
  request: Partial<Request>,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const next: NextFunction = (error?: unknown) => resolve(error);

    try {
      Promise.resolve(middleware(request as Request, {} as Response, next)).catch(reject);
    } catch (error) {
      reject(error);
    }
  });
}

test('login limits by trusted Express IP and normalized opaque email identity before bcrypt', async () => {
  const checks: Array<{ policy: string; subject: string }> = [];
  const middleware = createAuthRateLimitMiddleware({
    async consume(policy: AuthRateLimitPolicy, subject: string) {
      checks.push({ policy: policy.name, subject });
      return { allowed: true, retryAfterSeconds: policy.windowSeconds };
    },
  });

  assert.equal(
    await runMiddleware(middleware.limitLogin, {
      ip: '203.0.113.10',
      body: { email: ' Developer@Example.com ', password: 'not-yet-hashed' },
      socket: {} as Request['socket'],
    }),
    undefined,
  );
  assert.deepEqual(checks, [
    { policy: 'login-ip', subject: '203.0.113.10' },
    { policy: 'login-identity', subject: 'developer@example.com' },
  ]);
});

test('a rejected limiter returns 429 with Retry-After and never reaches business logic', async () => {
  let businessLogicExecutions = 0;
  const middleware = createAuthRateLimitMiddleware({
    async consume() {
      return { allowed: false, retryAfterSeconds: 37 };
    },
  });
  const error = await runMiddleware(middleware.limitRegistration, {
    ip: '203.0.113.11',
    socket: {} as Request['socket'],
  });

  if (error === undefined) {
    businessLogicExecutions += 1;
  }

  assert.equal(businessLogicExecutions, 0);
  assert.ok(error instanceof AppError);
  assert.equal(error.statusCode, 429);
  assert.equal(error.code, 'RATE_LIMITED');
  assert.deepEqual(error.headers, { 'Retry-After': '37' });
});

test('Redis limiter failure fails closed with a safe 503', async () => {
  const middleware = createAuthRateLimitMiddleware({
    async consume() {
      throw new Error('Redis connection details that must not escape');
    },
  });
  const error = await runMiddleware(middleware.limitVerificationSubmission, {
    ip: '203.0.113.12',
    socket: {} as Request['socket'],
  });

  assert.ok(error instanceof AppError);
  assert.equal(error.statusCode, 503);
  assert.equal(error.code, 'AUTH_PROTECTION_UNAVAILABLE');
  assert.equal(error.message.includes('Redis'), false);
});

test('resend applies both authenticated-user and IP limits', async () => {
  const checks: Array<{ policy: string; subject: string }> = [];
  const middleware = createAuthRateLimitMiddleware({
    async consume(policy, subject) {
      checks.push({ policy: policy.name, subject });
      return { allowed: true, retryAfterSeconds: 60 };
    },
  });

  await runMiddleware(middleware.limitVerificationResend, {
    ip: '203.0.113.13',
    socket: {} as Request['socket'],
    user: {
      sessionId: 'session-a',
      userId: 'user-a',
      email: 'user-a@example.com',
      emailVerified: false,
    },
  });

  assert.deepEqual(checks, [
    { policy: 'verification-resend-user', subject: 'user-a' },
    { policy: 'verification-resend-ip', subject: '203.0.113.13' },
  ]);
});
