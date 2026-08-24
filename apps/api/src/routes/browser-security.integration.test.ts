import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import test from 'node:test';

import { app } from '../app.js';
import { env } from '../config/env.js';
import { disconnectPrisma, prisma } from '../config/prisma.js';
import { csrfTokenForSession } from '../middleware/csrf.js';
import { createTestSession } from '../test/auth-session.js';

interface ApiResponse {
  body: unknown;
  headers: Headers;
  status: number;
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('listening', resolve);
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test('browser security boundary rejects forged mutations before business logic', async () => {
  const suffix = randomUUID();
  const userId = `browser-security-${suffix}`;
  const server = app.listen(0, '127.0.0.1');
  await listen(server);
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function request(
    path: string,
    options: {
      body?: FormData | string;
      contentType?: string;
      cookie?: string;
      csrfToken?: string;
      method?: string;
      origin?: string | null;
    } = {},
  ): Promise<ApiResponse> {
    const headers: Record<string, string> = {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.csrfToken ? { 'x-csrf-token': options.csrfToken } : {}),
      ...(options.contentType ? { 'content-type': options.contentType } : {}),
      ...(options.origin === null ? {} : { origin: options.origin ?? env.corsOrigin }),
    };
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      ...(options.body === undefined ? {} : { body: options.body }),
    });

    return {
      status: response.status,
      headers: response.headers,
      body: (await response.json()) as unknown,
    };
  }

  try {
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        passwordHash: 'test-only',
        emailVerifiedAt: new Date(),
      },
    });
    const session = await createTestSession(userId);
    const validCsrfToken = csrfTokenForSession(session.token);

    const tokenResponse = await request('/api/auth/csrf-token', {
      cookie: session.cookieHeader,
    });
    assert.equal(tokenResponse.status, 200);
    assert.deepEqual(tokenResponse.body, { data: { csrfToken: validCsrfToken } });
    assert.equal(tokenResponse.headers.get('cache-control'), 'private, no-store');

    const missingOrigin = await request('/api/conversations', {
      method: 'POST',
      cookie: session.cookieHeader,
      csrfToken: validCsrfToken,
      origin: null,
    });
    assert.equal(missingOrigin.status, 403);
    assert.equal((missingOrigin.body as { error: { code: string } }).error.code, 'INVALID_ORIGIN');

    const maliciousOrigin = await request('/api/conversations', {
      method: 'POST',
      cookie: session.cookieHeader,
      csrfToken: validCsrfToken,
      origin: 'https://malicious.example',
    });
    assert.equal(maliciousOrigin.status, 403);
    assert.equal(
      (maliciousOrigin.body as { error: { code: string } }).error.code,
      'INVALID_ORIGIN',
    );

    const missingToken = await request('/api/conversations', {
      method: 'POST',
      cookie: session.cookieHeader,
    });
    assert.equal(missingToken.status, 403);
    assert.equal(
      (missingToken.body as { error: { code: string } }).error.code,
      'CSRF_VALIDATION_FAILED',
    );

    const invalidToken = await request('/api/conversations', {
      method: 'POST',
      cookie: session.cookieHeader,
      csrfToken: 'invalid-token',
    });
    assert.equal(invalidToken.status, 403);

    const multipartBody = new FormData();
    multipartBody.set('file', new Blob(['%PDF-test'], { type: 'application/pdf' }), 'Test.pdf');
    const blockedMultipart = await request('/api/documents', {
      method: 'POST',
      cookie: session.cookieHeader,
      body: multipartBody,
    });
    assert.equal(blockedMultipart.status, 403);
    assert.equal(await prisma.document.count({ where: { userId } }), 0);

    const accepted = await request('/api/conversations', {
      method: 'POST',
      cookie: session.cookieHeader,
      csrfToken: validCsrfToken,
    });
    assert.equal(accepted.status, 201);
    assert.equal(accepted.headers.get('cache-control'), 'private, no-store');
    assert.equal(await prisma.conversation.count({ where: { userId } }), 1);

    const privateRead = await request('/api/auth/me', { cookie: session.cookieHeader });
    assert.equal(privateRead.status, 200);
    assert.equal(privateRead.headers.get('cache-control'), 'private, no-store');
    assert.match(
      privateRead.headers.get('content-security-policy') ?? '',
      /frame-ancestors 'none'/,
    );
    assert.equal(privateRead.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(privateRead.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal(
      privateRead.headers.get('permissions-policy'),
      'camera=(), microphone=(), geolocation=()',
    );
    assert.equal(privateRead.headers.get('x-frame-options'), 'DENY');
  } finally {
    await prisma.user.deleteMany({ where: { id: userId } });
    await closeServer(server);
    await disconnectPrisma();
  }
});
