import { resolve } from 'node:path';

export type WorkerNodeEnvironment = 'development' | 'production' | 'test';
export type WorkerEnvironmentSource = Readonly<Record<string, string | undefined>>;

function requireEnvironmentVariable(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function parseWorkerNodeEnvironment(value: string | undefined): WorkerNodeEnvironment {
  const environment = value ?? 'development';

  if (environment !== 'development' && environment !== 'production' && environment !== 'test') {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  return environment;
}

function productionValueOrDefault(
  name: string,
  value: string | undefined,
  fallback: string,
  nodeEnvironment: WorkerNodeEnvironment,
): string {
  if (nodeEnvironment === 'production') {
    return requireEnvironmentVariable(name, value);
  }

  return value ?? fallback;
}

function environmentValueOrDefault(
  name: string,
  value: string | undefined,
  fallback: string,
): string {
  const resolvedValue = value ?? fallback;

  if (!resolvedValue.trim()) {
    throw new Error(`${name} must not be empty`);
  }

  return resolvedValue;
}

function parsePositiveInteger(name: string, value: string | undefined, fallback: number): number {
  const parsedValue = Number(value ?? fallback);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsedValue;
}

function parsePositiveUsdToMicroUsd(
  name: string,
  value: string | undefined,
  fallback: string,
): bigint {
  const resolved = value ?? fallback;

  if (!/^\d+(?:\.\d{1,6})?$/.test(resolved)) {
    throw new Error(`${name} must be a positive USD amount with at most six decimal places`);
  }

  const [whole = '0', fraction = ''] = resolved.split('.');
  const microUsd = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));

  if (microUsd <= 0n) {
    throw new Error(`${name} must be greater than zero`);
  }

  return microUsd;
}

export function parseWorkerStorageDriver(
  value: string | undefined,
  nodeEnvironment: WorkerNodeEnvironment,
): 'local' | 'r2' {
  const driver = value ?? 'local';

  if (driver !== 'local' && driver !== 'r2') {
    throw new Error('STORAGE_DRIVER must be either local or r2');
  }

  if (nodeEnvironment === 'production' && driver !== 'r2') {
    throw new Error('STORAGE_DRIVER must be r2 in production');
  }

  return driver;
}

export function createWorkerEnvironment(
  source: WorkerEnvironmentSource,
  repositoryRootPath: string,
) {
  const nodeEnv = parseWorkerNodeEnvironment(source.NODE_ENV);
  const storageDriver = parseWorkerStorageDriver(source.STORAGE_DRIVER, nodeEnv);
  const redisUrl = productionValueOrDefault(
    'REDIS_URL',
    source.REDIS_URL,
    'redis://localhost:6379',
    nodeEnv,
  );
  const openAiApiKey =
    nodeEnv === 'production'
      ? requireEnvironmentVariable('OPENAI_API_KEY', source.OPENAI_API_KEY)
      : source.OPENAI_API_KEY;
  const openaiEmbeddingModel = productionValueOrDefault(
    'OPENAI_EMBEDDING_MODEL',
    source.OPENAI_EMBEDDING_MODEL,
    'text-embedding-3-small',
    nodeEnv,
  );
  const r2Endpoint =
    storageDriver === 'r2'
      ? requireEnvironmentVariable('R2_ENDPOINT', source.R2_ENDPOINT)
      : source.R2_ENDPOINT;
  const r2AccessKeyId =
    storageDriver === 'r2'
      ? requireEnvironmentVariable('R2_ACCESS_KEY_ID', source.R2_ACCESS_KEY_ID)
      : source.R2_ACCESS_KEY_ID;
  const r2SecretAccessKey =
    storageDriver === 'r2'
      ? requireEnvironmentVariable('R2_SECRET_ACCESS_KEY', source.R2_SECRET_ACCESS_KEY)
      : source.R2_SECRET_ACCESS_KEY;
  const r2BucketName =
    storageDriver === 'r2'
      ? requireEnvironmentVariable('R2_BUCKET_NAME', source.R2_BUCKET_NAME)
      : source.R2_BUCKET_NAME;

  return Object.freeze({
    nodeEnv,
    databaseUrl: requireEnvironmentVariable('DATABASE_URL', source.DATABASE_URL),
    redisUrl,
    documentWorkerConcurrency: parsePositiveInteger(
      'DOCUMENT_WORKER_CONCURRENCY',
      source.DOCUMENT_WORKER_CONCURRENCY,
      1,
    ),
    embeddingWorkerConcurrency: parsePositiveInteger(
      'EMBEDDING_WORKER_CONCURRENCY',
      source.EMBEDDING_WORKER_CONCURRENCY,
      1,
    ),
    openAiApiKey,
    openaiEmbeddingModel: environmentValueOrDefault(
      'OPENAI_EMBEDDING_MODEL',
      openaiEmbeddingModel,
      'text-embedding-3-small',
    ),
    globalOpenAiMonthlyBudgetMicroUsd: parsePositiveUsdToMicroUsd(
      'GLOBAL_OPENAI_MONTHLY_BUDGET_USD',
      source.GLOBAL_OPENAI_MONTHLY_BUDGET_USD,
      '20',
    ),
    storageDriver,
    localStoragePath: resolve(repositoryRootPath, source.LOCAL_STORAGE_PATH ?? '.local-storage'),
    r2Endpoint,
    r2AccessKeyId,
    r2SecretAccessKey,
    r2BucketName,
  });
}
