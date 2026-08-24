import { readFile, stat, unlink } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

import {
  ObjectStorageDeleteError,
  ObjectStorageReadError,
  ObjectStorageSizeMismatchError,
  type ObjectStorage,
} from '../../services/object-storage.service.js';

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export class LocalObjectStorageReader implements ObjectStorage {
  private readonly rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = resolve(rootPath);
  }

  async downloadFile(storageKey: string, expectedSizeBytes: bigint): Promise<Buffer> {
    try {
      const filePath = this.resolveStorageKey(storageKey);
      const metadata = await stat(filePath);

      if (BigInt(metadata.size) !== expectedSizeBytes) {
        throw new ObjectStorageSizeMismatchError();
      }

      const content = await readFile(filePath);

      if (BigInt(content.byteLength) !== expectedSizeBytes) {
        throw new ObjectStorageSizeMismatchError();
      }

      return content;
    } catch (error) {
      if (error instanceof ObjectStorageReadError) {
        throw error;
      }

      throw new ObjectStorageReadError('Stored document file could not be read', { cause: error });
    }
  }

  async deleteFile(storageKey: string): Promise<void> {
    try {
      await unlink(this.resolveStorageKey(storageKey));
    } catch (error) {
      if (isMissingFileError(error)) {
        return;
      }

      throw new ObjectStorageDeleteError('Stored document file could not be deleted');
    }
  }

  private resolveStorageKey(storageKey: string): string {
    const filePath = resolve(this.rootPath, storageKey);

    if (!filePath.startsWith(`${this.rootPath}${sep}`)) {
      throw new ObjectStorageReadError(
        'Storage key resolves outside the configured local storage directory',
      );
    }

    return filePath;
  }
}
