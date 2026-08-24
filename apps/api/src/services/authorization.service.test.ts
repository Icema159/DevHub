import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../utils/app-error.js';
import { authorizeResourceOwner } from './authorization.service.js';

const authenticatedUser = {
  userId: 'user-a',
  email: 'user-a@example.com',
  emailVerified: true,
  sessionId: 'session-a',
};

test('allows an authenticated user to access their own resource', () => {
  const ownDocument = {
    id: 'document-a',
    userId: 'user-a',
  };

  assert.equal(authorizeResourceOwner(authenticatedUser, ownDocument), ownDocument);
});

test('rejects access to a resource owned by another user', () => {
  const anotherUsersDocument = {
    id: 'document-b',
    userId: 'user-b',
  };

  assert.throws(
    () => authorizeResourceOwner(authenticatedUser, anotherUsersDocument),
    (error) => error instanceof AppError && error.statusCode === 403 && error.code === 'FORBIDDEN',
  );
});
