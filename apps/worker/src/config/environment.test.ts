import assert from 'node:assert/strict';
import test from 'node:test';

import { createWorkerEnvironment, type WorkerEnvironmentSource } from './environment.js';

const productionEnvironment: WorkerEnvironmentSource = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:password@database.internal:5432/hub',
  REDIS_URL: 'redis://default:password@redis.internal:6379',
  STORAGE_DRIVER: 'r2',
  R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
  R2_ACCESS_KEY_ID: 'access-key',
  R2_SECRET_ACCESS_KEY: 'secret-key',
  R2_BUCKET_NAME: 'documents',
  OPENAI_API_KEY: 'openai-key',
  OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small',
};

test('worker accepts explicit production infrastructure and provider configuration', () => {
  const environment = createWorkerEnvironment(productionEnvironment, '/repository');

  assert.equal(environment.nodeEnv, 'production');
  assert.equal(environment.storageDriver, 'r2');
  assert.equal(environment.documentWorkerConcurrency, 1);
  assert.equal(environment.embeddingWorkerConcurrency, 1);
});

test('worker production configuration rejects localhost-style fallbacks', () => {
  assert.throws(
    () =>
      createWorkerEnvironment({ ...productionEnvironment, REDIS_URL: undefined }, '/repository'),
    /REDIS_URL/,
  );
  assert.throws(
    () =>
      createWorkerEnvironment({ ...productionEnvironment, STORAGE_DRIVER: 'local' }, '/repository'),
    /STORAGE_DRIVER must be r2/,
  );
  assert.throws(
    () =>
      createWorkerEnvironment({ ...productionEnvironment, R2_ENDPOINT: undefined }, '/repository'),
    /R2_ENDPOINT/,
  );
  assert.throws(
    () =>
      createWorkerEnvironment(
        { ...productionEnvironment, OPENAI_API_KEY: undefined },
        '/repository',
      ),
    /OPENAI_API_KEY/,
  );
});

test('worker retains development defaults for local infrastructure', () => {
  const environment = createWorkerEnvironment(
    { DATABASE_URL: 'postgresql://localhost/hub' },
    '/repository',
  );

  assert.equal(environment.nodeEnv, 'development');
  assert.equal(environment.redisUrl, 'redis://localhost:6379');
  assert.equal(environment.storageDriver, 'local');
});
