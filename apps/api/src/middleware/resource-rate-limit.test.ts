import assert from 'node:assert/strict';
import test from 'node:test';

import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error.js';
import { createResourceRateLimitMiddleware } from './resource-rate-limit.js';

function request(ip = '127.0.0.1'): Request {
  return { ip, socket: { remoteAddress: ip } } as Request;
}

function run(
  middleware: ReturnType<typeof createResourceRateLimitMiddleware>['limitUploadByIp'],
  input = request(),
): Promise<unknown> {
  return new Promise((resolve) => {
    middleware(input, {} as Response, ((error?: unknown) => resolve(error)) as NextFunction);
  });
}

test('resource limiter uses trusted Express IP and rejects before route work', async () => {
  const subjects: string[] = [];
  const middleware = createResourceRateLimitMiddleware({
    async consume(_policy, subject) {
      subjects.push(subject);
      return { allowed: false, retryAfterSeconds: 37 };
    },
  });

  const error = await run(middleware.limitUploadByIp);
  assert.deepEqual(subjects, ['127.0.0.1']);
  assert.ok(error instanceof AppError);
  assert.equal(error.code, 'RESOURCE_RATE_LIMITED');
  assert.equal(error.headers['Retry-After'], '37');
});

test('resource limiter fails closed without exposing Redis details', async () => {
  const middleware = createResourceRateLimitMiddleware({
    async consume() {
      throw new Error('redis://secret-host:6379');
    },
  });

  const error = await run(middleware.limitUploadByIp);
  assert.ok(error instanceof AppError);
  assert.equal(error.code, 'RESOURCE_PROTECTION_UNAVAILABLE');
  assert.equal(error.message.includes('Redis'), false);
});
