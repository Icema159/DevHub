import { config as loadEnvironment } from 'dotenv';
import { fileURLToPath } from 'node:url';

import {
  createWorkerEnvironment,
  parseWorkerNodeEnvironment,
  parseWorkerStorageDriver,
} from './environment.js';

const workerEnvironmentPath = fileURLToPath(new URL('../../.env', import.meta.url));
const rootEnvironmentPath = fileURLToPath(new URL('../../../../.env', import.meta.url));
const repositoryRootPath = fileURLToPath(new URL('../../../../', import.meta.url));

loadEnvironment({
  path: [workerEnvironmentPath, rootEnvironmentPath],
  quiet: true,
});

export { parseWorkerNodeEnvironment, parseWorkerStorageDriver };

export const env = createWorkerEnvironment(process.env, repositoryRootPath);

export function requireOpenAiApiKey(): string {
  if (!env.openAiApiKey) {
    throw new Error('Missing required environment variable: OPENAI_API_KEY');
  }

  return env.openAiApiKey;
}
