import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

import {
  createDocumentStorageKey,
  type ObjectStorage,
  type UploadObjectInput,
} from '../../services/object-storage.service.js';

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export class LocalObjectStorage implements ObjectStorage {
  private readonly rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = resolve(rootPath);
  }

  async uploadFile(input: UploadObjectInput): Promise<string> {
    const storageKey = createDocumentStorageKey(input.userId);
    const filePath = this.resolveStorageKey(storageKey);

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, input.content, { flag: 'wx' });

    return storageKey;
  }

  async deleteFile(storageKey: string): Promise<void> {
    try {
      await unlink(this.resolveStorageKey(storageKey));
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }
  }

  private resolveStorageKey(storageKey: string): string {
    const filePath = resolve(this.rootPath, storageKey);

    if (!filePath.startsWith(`${this.rootPath}${sep}`)) {
      throw new Error('Storage key resolves outside the configured local storage directory');
    }

    return filePath;
  }
}
