import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from './app-error.js';
import { parseAuthCredentials, parseVerificationToken } from './auth-input.js';

test('normalizes valid authentication credentials', () => {
  assert.deepEqual(
    parseAuthCredentials({
      email: '  Developer@Example.COM ',
      password: 'valid-password',
    }),
    {
      email: 'developer@example.com',
      password: 'valid-password',
    },
  );
});

test('rejects malformed email input', () => {
  assert.throws(
    () => parseAuthCredentials({ email: 'invalid-email', password: 'valid-password' }),
    (error) => error instanceof AppError && error.statusCode === 400,
  );
});

test('rejects short passwords', () => {
  assert.throws(
    () => parseAuthCredentials({ email: 'developer@example.com', password: 'short' }),
    (error) => error instanceof AppError && error.statusCode === 400,
  );
});

test('rejects passwords longer than bcrypt can process safely', () => {
  assert.throws(
    () => parseAuthCredentials({ email: 'developer@example.com', password: 'a'.repeat(73) }),
    (error) => error instanceof AppError && error.statusCode === 400,
  );
});

test('accepts only the exact cookie-safe verification token contract', () => {
  assert.equal(parseVerificationToken({ token: 'a'.repeat(43) }), 'a'.repeat(43));
  assert.throws(
    () => parseVerificationToken({ token: '<script>not-a-token</script>' }),
    (error) => error instanceof AppError && error.code === 'INVALID_INPUT',
  );
});
