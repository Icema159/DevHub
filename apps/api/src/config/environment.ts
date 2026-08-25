import { resolve } from 'node:path';

export type NodeEnvironment = 'development' | 'production' | 'test';

export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

function requireEnvironmentVariable(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function productionValueOrDefault(
  name: string,
  value: string | undefined,
  fallback: string,
  nodeEnvironment: NodeEnvironment,
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

export function parseNodeEnvironment(value: string | undefined): NodeEnvironment {
  const environment = value ?? 'development';

  if (environment !== 'development' && environment !== 'production' && environment !== 'test') {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  return environment;
}

export function parseCorsOrigin(
  value: string | undefined,
  nodeEnvironment: NodeEnvironment,
): string {
  const configuredOrigin = productionValueOrDefault(
    'CORS_ORIGIN',
    value,
    'http://localhost:5173',
    nodeEnvironment,
  );

  if (configuredOrigin === '*' || configuredOrigin === 'null') {
    throw new Error('CORS_ORIGIN must be one explicit http or https origin');
  }

  const parsedUrl = new URL(configuredOrigin);

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('CORS_ORIGIN must use the http or https protocol');
  }

  if (
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.pathname !== '/' ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error('CORS_ORIGIN must contain only an origin without credentials or a path');
  }

  if (nodeEnvironment === 'production' && parsedUrl.protocol !== 'https:') {
    throw new Error('CORS_ORIGIN must use https in production');
  }

  return parsedUrl.origin;
}

function parseCsrfSecret(value: string | undefined, nodeEnvironment: NodeEnvironment): string {
  if (nodeEnvironment !== 'production') {
    return value ?? 'development-only-csrf-secret';
  }

  if (!value || value.length < 32) {
    throw new Error('CSRF_SECRET must contain at least 32 characters in production');
  }

  return value;
}

export function parsePort(
  portValue: string | undefined,
  apiPortValue: string | undefined,
  nodeEnvironment: NodeEnvironment = 'development',
): number {
  const configuredValue =
    nodeEnvironment === 'production'
      ? (portValue ?? apiPortValue ?? '3000')
      : (apiPortValue ?? portValue ?? '3000');
  const port = Number(configuredValue);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT or API_PORT must be an integer between 1 and 65535');
  }

  return port;
}

function parsePositiveInteger(
  name: string,
  value: string | undefined,
  defaultValue: number,
): number {
  const parsedValue = Number(value ?? defaultValue);

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

function parseBoolean(name: string, value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new Error(`${name} must be either true or false`);
}

export function parsePublicBaseUrl(
  value: string | undefined,
  nodeEnvironment: NodeEnvironment,
): string {
  const configuredUrl = productionValueOrDefault(
    'APP_BASE_URL',
    value,
    'http://localhost:5173',
    nodeEnvironment,
  );
  const parsedUrl = new URL(configuredUrl);

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('APP_BASE_URL must use the http or https protocol');
  }

  if (
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.pathname !== '/' ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error('APP_BASE_URL must contain only an origin without credentials or a path');
  }

  if (nodeEnvironment === 'production' && parsedUrl.protocol !== 'https:') {
    throw new Error('APP_BASE_URL must use https in production');
  }

  return parsedUrl.origin;
}

function parseEmailDeliveryDriver(
  value: string | undefined,
  nodeEnvironment: NodeEnvironment,
): 'console' | 'resend' | 'smtp' {
  const driver = value ?? (nodeEnvironment === 'production' ? 'resend' : 'console');

  if (driver !== 'console' && driver !== 'resend' && driver !== 'smtp') {
    throw new Error('EMAIL_DELIVERY_DRIVER must be console, resend, or smtp');
  }

  if (nodeEnvironment === 'production' && driver === 'console') {
    throw new Error('EMAIL_DELIVERY_DRIVER=console is not allowed in production');
  }

  return driver;
}

export function parseStorageDriver(
  value: string | undefined,
  nodeEnvironment: NodeEnvironment,
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

export function parseTrustedProxyHops(
  value: string | undefined,
  nodeEnvironment: NodeEnvironment,
): number {
  if (nodeEnvironment === 'production' && value === undefined) {
    throw new Error('TRUSTED_PROXY_HOPS must be explicitly configured in production');
  }

  const hops = Number(value ?? '0');

  if (!Number.isInteger(hops) || hops < 0 || hops > 2) {
    throw new Error('TRUSTED_PROXY_HOPS must be an integer between 0 and 2');
  }

  return hops;
}

export function createApiEnvironment(source: EnvironmentSource, repositoryRootPath: string) {
  const nodeEnv = parseNodeEnvironment(source.NODE_ENV);
  const corsOrigin = parseCorsOrigin(source.CORS_ORIGIN, nodeEnv);
  const appBaseUrl = parsePublicBaseUrl(source.APP_BASE_URL, nodeEnv);
  const emailDeliveryDriver = parseEmailDeliveryDriver(source.EMAIL_DELIVERY_DRIVER, nodeEnv);
  const storageDriver = parseStorageDriver(source.STORAGE_DRIVER, nodeEnv);
  const smtpUsername = source.SMTP_USERNAME;
  const smtpPassword = source.SMTP_PASSWORD;

  if (nodeEnv === 'production' && corsOrigin !== appBaseUrl) {
    throw new Error('CORS_ORIGIN and APP_BASE_URL must use the same production Web origin');
  }

  if (
    emailDeliveryDriver === 'smtp' &&
    ((smtpUsername && !smtpPassword) || (!smtpUsername && smtpPassword))
  ) {
    throw new Error('SMTP_USERNAME and SMTP_PASSWORD must be configured together');
  }

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
  const openaiChatModel = productionValueOrDefault(
    'OPENAI_CHAT_MODEL',
    source.OPENAI_CHAT_MODEL,
    'gpt-5.6-sol',
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
    port: parsePort(source.PORT, source.API_PORT, nodeEnv),
    trustedProxyHops: parseTrustedProxyHops(source.TRUSTED_PROXY_HOPS, nodeEnv),
    corsOrigin,
    csrfSecret: parseCsrfSecret(source.CSRF_SECRET, nodeEnv),
    appBaseUrl,
    databaseUrl: requireEnvironmentVariable('DATABASE_URL', source.DATABASE_URL),
    redisUrl,
    emailDeliveryDriver,
    resendApiKey:
      emailDeliveryDriver === 'resend'
        ? requireEnvironmentVariable('RESEND_API_KEY', source.RESEND_API_KEY)
        : undefined,
    emailFrom:
      emailDeliveryDriver === 'resend'
        ? requireEnvironmentVariable('EMAIL_FROM', source.EMAIL_FROM)
        : undefined,
    smtpHost:
      emailDeliveryDriver === 'smtp'
        ? requireEnvironmentVariable('SMTP_HOST', source.SMTP_HOST)
        : undefined,
    smtpPort:
      emailDeliveryDriver === 'smtp'
        ? parsePositiveInteger('SMTP_PORT', source.SMTP_PORT, 587)
        : undefined,
    smtpSecure:
      emailDeliveryDriver === 'smtp'
        ? parseBoolean('SMTP_SECURE', source.SMTP_SECURE, false)
        : undefined,
    smtpUsername: emailDeliveryDriver === 'smtp' ? smtpUsername : undefined,
    smtpPassword: emailDeliveryDriver === 'smtp' ? smtpPassword : undefined,
    smtpFrom:
      emailDeliveryDriver === 'smtp'
        ? requireEnvironmentVariable('SMTP_FROM', source.SMTP_FROM)
        : undefined,
    storageDriver,
    localStoragePath: resolve(repositoryRootPath, source.LOCAL_STORAGE_PATH ?? '.local-storage'),
    maxUploadSizeBytes: parsePositiveInteger(
      'MAX_UPLOAD_SIZE_BYTES',
      source.MAX_UPLOAD_SIZE_BYTES,
      10 * 1024 * 1024,
    ),
    openAiApiKey,
    openaiEmbeddingModel: environmentValueOrDefault(
      'OPENAI_EMBEDDING_MODEL',
      openaiEmbeddingModel,
      'text-embedding-3-small',
    ),
    openaiChatModel: environmentValueOrDefault('OPENAI_CHAT_MODEL', openaiChatModel, 'gpt-5.6-sol'),
    openaiChatMaxOutputTokens: parsePositiveInteger(
      'OPENAI_CHAT_MAX_OUTPUT_TOKENS',
      source.OPENAI_CHAT_MAX_OUTPUT_TOKENS,
      1200,
    ),
    globalOpenAiMonthlyBudgetMicroUsd: parsePositiveUsdToMicroUsd(
      'GLOBAL_OPENAI_MONTHLY_BUDGET_USD',
      source.GLOBAL_OPENAI_MONTHLY_BUDGET_USD,
      '20',
    ),
    r2Endpoint,
    r2AccessKeyId,
    r2SecretAccessKey,
    r2BucketName,
  });
}
