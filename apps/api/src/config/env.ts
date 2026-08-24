import { config as loadEnvironment } from 'dotenv';
import { fileURLToPath } from 'node:url';

import {
  createApiEnvironment,
  parseCorsOrigin,
  parseNodeEnvironment,
  parsePort,
  parsePublicBaseUrl,
  parseStorageDriver,
  parseTrustedProxyHops,
  type NodeEnvironment,
} from './environment.js';

const apiEnvironmentPath = fileURLToPath(new URL('../../.env', import.meta.url));
const rootEnvironmentPath = fileURLToPath(new URL('../../../../.env', import.meta.url));
const repositoryRootPath = fileURLToPath(new URL('../../../../', import.meta.url));

loadEnvironment({
  path: [apiEnvironmentPath, rootEnvironmentPath],
  quiet: true,
});

export {
  parseCorsOrigin,
  parseNodeEnvironment,
  parsePort,
  parsePublicBaseUrl,
  parseStorageDriver,
  parseTrustedProxyHops,
};
export type { NodeEnvironment };

export const env = createApiEnvironment(process.env, repositoryRootPath);

export function requireOpenAiApiKey(): string {
  if (!env.openAiApiKey) {
    throw new Error('Missing required environment variable: OPENAI_API_KEY');
  }

  return env.openAiApiKey;
}
