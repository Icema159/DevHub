import assert from 'node:assert/strict';
import test from 'node:test';

import { generateOpaqueToken, hashOpaqueToken, OPAQUE_TOKEN_BYTES } from './secure-token.js';

test('generates at least 256 bits of cookie-safe opaque entropy', () => {
  const first = generateOpaqueToken();
  const second = generateOpaqueToken();

  assert.equal(Buffer.from(first, 'base64url').byteLength, OPAQUE_TOKEN_BYTES);
  assert.equal(OPAQUE_TOKEN_BYTES, 32);
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
});

test('hashes bearer tokens deterministically with SHA-256 hex output', () => {
  const token = 'test-session-token';

  assert.equal(
    hashOpaqueToken(token),
    '7a16f44e82f892c5db994ff1fe2c468656ad31af77ebe04b1d02be3bf8d4cc8e',
  );
  assert.match(hashOpaqueToken(token), /^[a-f0-9]{64}$/);
  assert.notEqual(hashOpaqueToken(token), token);
});
