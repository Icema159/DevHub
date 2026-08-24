import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';

import { AUTH_COOKIE_NAME } from '../config/auth-cookie.js';
import { disconnectPrisma, prisma } from '../config/prisma.js';
import { createTestSession } from '../test/auth-session.js';
import { AppError } from '../utils/app-error.js';
import { authenticate } from './authenticate.js';

interface AuthenticationResult {
  request: Request;
  error: unknown;
}

async function runAuthentication(cookieHeader?: string): Promise<AuthenticationResult> {
  const headers = cookieHeader ? { cookie: cookieHeader } : {};
  const request = { headers } as Request;
  const response = {} as Response;

  return new Promise((resolve, reject) => {
    const next: NextFunction = (error?: unknown) => {
      resolve({ request, error });
    };

    try {
      Promise.resolve(authenticate(request, response, next)).catch(reject);
    } catch (error) {
      reject(error);
    }
  });
}

async function createFixtureUser(emailVerified = true): Promise<{
  email: string;
  id: string;
}> {
  const suffix = randomUUID();
  const user = {
    id: `authenticate-user-${suffix}`,
    email: `authenticate-${suffix}@example.com`,
  };

  await prisma.user.create({
    data: {
      ...user,
      passwordHash: 'test-only',
      emailVerifiedAt: emailVerified ? new Date() : null,
    },
  });

  return user;
}

function assertUnauthenticated(result: AuthenticationResult): void {
  assert.ok(result.error instanceof AppError);
  assert.equal(result.error.statusCode, 401);
  assert.equal(result.error.code, 'UNAUTHENTICATED');
  assert.equal(result.request.user, undefined);
}

test.after(async () => {
  await prisma.user.deleteMany({ where: { id: { startsWith: 'authenticate-user-' } } });
  await disconnectPrisma();
});

test('attaches database-authoritative session and user state to req.user', async () => {
  const user = await createFixtureUser();
  const session = await createTestSession(user.id);
  const result = await runAuthentication(session.cookieHeader);

  assert.equal(result.error, undefined);
  assert.deepEqual(result.request.user, {
    userId: user.id,
    email: user.email,
    emailVerified: true,
    sessionId: session.sessionId,
  });
});

test('rejects a missing session cookie', async () => {
  assertUnauthenticated(await runAuthentication());
});

test('rejects a random or tampered session credential', async () => {
  assertUnauthenticated(
    await runAuthentication(`${AUTH_COOKIE_NAME}=not-a-real-session-credential`),
  );
});

test('rejects an expired session', async () => {
  const user = await createFixtureUser();
  const session = await createTestSession(user.id, {
    expiresAt: new Date(Date.now() - 1_000),
  });

  assertUnauthenticated(await runAuthentication(session.cookieHeader));
});

test('rejects a revoked session', async () => {
  const user = await createFixtureUser();
  const session = await createTestSession(user.id, { revokedAt: new Date() });

  assertUnauthenticated(await runAuthentication(session.cookieHeader));
});

test('rejects a legacy JWT-shaped credential after the session cutover', async () => {
  const legacyJwt = ['eyJhbGciOiJIUzI1NiJ9', 'eyJ1c2VySWQiOiJvbGQtdXNlciJ9', 'signature'].join('.');

  assertUnauthenticated(await runAuthentication(`${AUTH_COOKIE_NAME}=${legacyJwt}`));
});
