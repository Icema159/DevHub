import assert from 'node:assert/strict';
import test from 'node:test';

import { SESSION_LIFETIME_MS } from '../config/auth-cookie.js';
import { hashOpaqueToken } from '../utils/secure-token.js';
import { createSessionService } from './session.service.js';

const now = new Date('2026-08-18T09:00:00.000Z');

function dependencies() {
  const created: Array<{ expiresAt: Date; tokenHash: string; userId: string }> = [];
  const revoked: Array<{ sessionId: string; userId: string; revokedAt: Date }> = [];

  return {
    created,
    revoked,
    implementation: {
      async create(input: { expiresAt: Date; tokenHash: string; userId: string }) {
        created.push(input);
      },
      async findActive() {
        return {
          sessionId: 'session-a',
          userId: 'user-a',
          userEmail: 'user-a@example.com',
          emailVerified: true,
        };
      },
      generateToken: () => 'raw-high-entropy-session-token',
      hashToken: hashOpaqueToken,
      now: () => now,
      async revoke(sessionId: string, userId: string, revokedAt: Date) {
        revoked.push({ sessionId, userId, revokedAt });
        return true;
      },
      async revokeAll() {
        return 2;
      },
    },
  };
}

test('stores only the session hash with an absolute seven-day expiry', async () => {
  const fixture = dependencies();
  const service = createSessionService(fixture.implementation);
  const issued = await service.issueSession('user-a');

  assert.equal(issued.token, 'raw-high-entropy-session-token');
  assert.equal(issued.expiresAt.getTime() - now.getTime(), SESSION_LIFETIME_MS);
  assert.deepEqual(fixture.created, [
    {
      userId: 'user-a',
      tokenHash: hashOpaqueToken(issued.token),
      expiresAt: issued.expiresAt,
    },
  ]);
  assert.equal(JSON.stringify(fixture.created).includes(issued.token), false);
});

test('maps only a current database session into authenticated request context', async () => {
  const fixture = dependencies();
  const service = createSessionService(fixture.implementation);

  assert.deepEqual(await service.authenticateSession('raw-token'), {
    sessionId: 'session-a',
    userId: 'user-a',
    email: 'user-a@example.com',
    emailVerified: true,
  });
});

test('supports current-session and all-session revocation operations', async () => {
  const fixture = dependencies();
  const service = createSessionService(fixture.implementation);

  assert.equal(await service.revokeCurrentSession('session-a', 'user-a'), true);
  assert.deepEqual(fixture.revoked, [{ sessionId: 'session-a', userId: 'user-a', revokedAt: now }]);
  assert.equal(await service.revokeAllUserSessions('user-a'), 2);
});
