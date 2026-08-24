import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';

import { parseCorsOrigin, parseNodeEnvironment } from './environment.js';
import {
  CONTENT_SECURITY_POLICY,
  createSecurityHeadersMiddleware,
} from '../middleware/browser-security.js';
import { createCsrfService } from '../services/csrf.service.js';

test('production browser configuration requires an explicit HTTPS CORS origin', () => {
  assert.equal(parseCorsOrigin('https://app.example.com', 'production'), 'https://app.example.com');
  assert.throws(() => parseCorsOrigin('*', 'production'), /explicit/);
  assert.throws(() => parseCorsOrigin('null', 'production'), /explicit/);
  assert.throws(() => parseCorsOrigin('http://app.example.com', 'production'), /https/);
  assert.throws(() => parseCorsOrigin('https://app.example.com/path', 'production'), /origin/);
  assert.throws(() => parseNodeEnvironment('staging'), /NODE_ENV/);
});

test('session-bound CSRF tokens validate only for their issuing session', () => {
  const service = createCsrfService('test-secret');
  const token = service.createToken('session-one');

  assert.equal(service.verifyToken('session-one', token), true);
  assert.equal(service.verifyToken('session-two', token), false);
  assert.equal(service.verifyToken('session-one', 'invalid-token'), false);
});

test('production security headers include CSP and HTTPS-only HSTS', async () => {
  const headers = new Map<string, string>();
  const response = {
    setHeader(name: string, value: string) {
      headers.set(name, value);
      return this;
    },
  } as Response;
  const middleware = createSecurityHeadersMiddleware({
    corsOrigin: 'https://app.example.com',
    nodeEnvironment: 'production',
  });

  await new Promise<void>((resolve, reject) => {
    const next: NextFunction = (error?: unknown) => (error ? reject(error) : resolve());
    middleware({} as Request, response, next);
  });

  assert.equal(headers.get('Content-Security-Policy'), CONTENT_SECURITY_POLICY);
  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.equal(headers.get('Permissions-Policy'), 'camera=(), microphone=(), geolocation=()');
  assert.equal(headers.get('X-Frame-Options'), 'DENY');
  assert.equal(headers.get('Strict-Transport-Security'), 'max-age=31536000');
});

test('HSTS is omitted outside an HTTPS production environment', async () => {
  const headers = new Map<string, string>();
  const response = {
    setHeader(name: string, value: string) {
      headers.set(name, value);
      return this;
    },
  } as Response;
  const middleware = createSecurityHeadersMiddleware({
    corsOrigin: 'http://localhost:5173',
    nodeEnvironment: 'development',
  });

  await new Promise<void>((resolve, reject) => {
    const next: NextFunction = (error?: unknown) => (error ? reject(error) : resolve());
    middleware({} as Request, response, next);
  });

  assert.equal(headers.has('Strict-Transport-Security'), false);
});
