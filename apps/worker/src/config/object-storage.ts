import { LocalObjectStorageReader } from '../infrastructure/storage/local-object-storage.js';
import { R2ObjectStorageReader } from '../infrastructure/storage/r2-object-storage.js';
import type {
  ObjectStorage,
  ObjectStorageDeleter,
  ObjectStorageReader,
} from '../services/object-storage.service.js';
import { env } from './env.js';

function requireR2Value(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required when STORAGE_DRIVER=r2`);
  }

  return value;
}

function createObjectStorage(): ObjectStorage {
  if (env.storageDriver === 'local') {
    return new LocalObjectStorageReader(env.localStoragePath);
  }

  return new R2ObjectStorageReader({
    endpoint: requireR2Value('R2_ENDPOINT', env.r2Endpoint),
    accessKeyId: requireR2Value('R2_ACCESS_KEY_ID', env.r2AccessKeyId),
    secretAccessKey: requireR2Value('R2_SECRET_ACCESS_KEY', env.r2SecretAccessKey),
    bucketName: requireR2Value('R2_BUCKET_NAME', env.r2BucketName),
  });
}

const objectStorage = createObjectStorage();

export const objectStorageReader: ObjectStorageReader = objectStorage;
export const objectStorageDeleter: ObjectStorageDeleter = objectStorage;
