import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createApiEnvironment,
  parsePort,
  parseTrustedProxyHops,
  type EnvironmentSource,
} from './environment.js';

const productionEnvironment: EnvironmentSource = {
  NODE_ENV: 'production',
  PORT: '8080',
  TRUSTED_PROXY_HOPS: '1',
  CORS_ORIGIN: 'https://hub.example.com',
  APP_BASE_URL: 'https://hub.example.com',
  CSRF_SECRET: 'a-production-csrf-secret-with-32-characters',
  DATABASE_URL: 'postgresql://user:password@database.internal:5432/hub',
  REDIS_URL: 'redis://default:password@redis.internal:6379',
  EMAIL_DELIVERY_DRIVER: 'resend',
  RESEND_API_KEY: 'resend-api-key',
  EMAIL_FROM: 'Developer Knowledge Hub <onboarding@resend.dev>',
  STORAGE_DRIVER: 'r2',
  R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
  R2_ACCESS_KEY_ID: 'access-key',
  R2_SECRET_ACCESS_KEY: 'secret-key',
  R2_BUCKET_NAME: 'documents',
  OPENAI_API_KEY: 'openai-key',
  OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small',
  OPENAI_CHAT_MODEL: 'gpt-5.6-sol',
};

test('production environment accepts explicit deployment configuration', () => {
  const environment = createApiEnvironment(productionEnvironment, '/repository');

  assert.equal(environment.nodeEnv, 'production');
  assert.equal(environment.port, 8080);
  assert.equal(environment.trustedProxyHops, 1);
  assert.equal(environment.storageDriver, 'r2');
  assert.equal(environment.emailDeliveryDriver, 'resend');
  assert.equal(environment.emailFrom, 'Developer Knowledge Hub <onboarding@resend.dev>');
});

test('Resend delivery fails fast without its API key or sender', () => {
  assert.throws(
    () =>
      createApiEnvironment({ ...productionEnvironment, RESEND_API_KEY: undefined }, '/repository'),
    /RESEND_API_KEY/,
  );
  assert.throws(
    () => createApiEnvironment({ ...productionEnvironment, EMAIL_FROM: undefined }, '/repository'),
    /EMAIL_FROM/,
  );
});

test('SMTP remains an optional provider with provider-specific validation', () => {
  const environment = createApiEnvironment(
    {
      ...productionEnvironment,
      EMAIL_DELIVERY_DRIVER: 'smtp',
      RESEND_API_KEY: undefined,
      EMAIL_FROM: undefined,
      SMTP_HOST: 'smtp.example.com',
      SMTP_FROM: 'Knowledge Hub <no-reply@example.com>',
    },
    '/repository',
  );

  assert.equal(environment.emailDeliveryDriver, 'smtp');
  assert.equal(environment.smtpHost, 'smtp.example.com');
  assert.equal(environment.resendApiKey, undefined);
});

test('Railway PORT has priority while API_PORT remains the local fallback', () => {
  assert.equal(parsePort('8080', '3000', 'production'), 8080);
  assert.equal(parsePort('8080', '3000', 'development'), 3000);
  assert.equal(parsePort(undefined, '3000'), 3000);
  assert.throws(() => parsePort('0', undefined), /between 1 and 65535/);
});

test('production rejects unsafe implicit service and storage configuration', () => {
  assert.throws(
    () => createApiEnvironment({ ...productionEnvironment, REDIS_URL: undefined }, '/repository'),
    /REDIS_URL/,
  );
  assert.throws(
    () =>
      createApiEnvironment({ ...productionEnvironment, STORAGE_DRIVER: 'local' }, '/repository'),
    /STORAGE_DRIVER must be r2/,
  );
  assert.throws(
    () =>
      createApiEnvironment({ ...productionEnvironment, R2_BUCKET_NAME: undefined }, '/repository'),
    /R2_BUCKET_NAME/,
  );
  assert.throws(
    () =>
      createApiEnvironment({ ...productionEnvironment, OPENAI_API_KEY: undefined }, '/repository'),
    /OPENAI_API_KEY/,
  );
});

test('production requires one explicit HTTPS browser origin', () => {
  assert.throws(
    () =>
      createApiEnvironment({ ...productionEnvironment, APP_BASE_URL: undefined }, '/repository'),
    /APP_BASE_URL/,
  );
  assert.throws(
    () =>
      createApiEnvironment(
        { ...productionEnvironment, APP_BASE_URL: 'http://hub.example.com' },
        '/repository',
      ),
    /https/,
  );
  assert.throws(
    () =>
      createApiEnvironment(
        { ...productionEnvironment, CORS_ORIGIN: 'https://other.example.com' },
        '/repository',
      ),
    /same production Web origin/,
  );
});

test('trusted proxy hops are explicit and narrowly bounded in production', () => {
  assert.equal(parseTrustedProxyHops(undefined, 'development'), 0);
  assert.equal(parseTrustedProxyHops('2', 'production'), 2);
  assert.throws(() => parseTrustedProxyHops(undefined, 'production'), /explicitly/);
  assert.throws(() => parseTrustedProxyHops('true', 'production'), /between 0 and 2/);
  assert.throws(() => parseTrustedProxyHops('3', 'production'), /between 0 and 2/);
});
