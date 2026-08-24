import assert from 'node:assert/strict';
import test from 'node:test';

import { createAuthCookieConfiguration, SESSION_LIFETIME_MS } from './auth-cookie.js';

test('uses a localhost-compatible secure-by-default development session cookie', () => {
  const configuration = createAuthCookieConfiguration('development');

  assert.equal(configuration.name, 'developer_knowledge_hub_session');
  assert.deepEqual(configuration.options, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: SESSION_LIFETIME_MS,
  });
  assert.equal('domain' in configuration.options, false);
});

test('uses __Host semantics and secure transport in production', () => {
  const configuration = createAuthCookieConfiguration('production');

  assert.equal(configuration.name, '__Host-developer-knowledge-hub-session');
  assert.equal(configuration.options.httpOnly, true);
  assert.equal(configuration.options.secure, true);
  assert.equal(configuration.options.sameSite, 'lax');
  assert.equal(configuration.options.path, '/');
  assert.equal(configuration.options.maxAge, 7 * 24 * 60 * 60 * 1000);
  assert.equal('domain' in configuration.options, false);
});
