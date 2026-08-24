import assert from 'node:assert/strict';
import test from 'node:test';

import { hashPassword, verifyPassword } from './password.js';

test('hashes passwords and verifies only the matching plaintext value', async () => {
  const password = 'correct-password';
  const passwordHash = await hashPassword(password);

  assert.notEqual(passwordHash, password);
  assert.equal(await verifyPassword(password, passwordHash), true);
  assert.equal(await verifyPassword('wrong-password', passwordHash), false);
});
