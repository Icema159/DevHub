export interface ObjectStorageReader {
  downloadFile(storageKey: string, expectedSizeBytes: bigint): Promise<Buffer>;
}

export interface ObjectStorageDeleter {
  deleteFile(storageKey: string): Promise<void>;
}

export type ObjectStorage = ObjectStorageReader & ObjectStorageDeleter;

export class ObjectStorageReadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ObjectStorageReadError';
  }
}

export class ObjectStorageSizeMismatchError extends ObjectStorageReadError {
  constructor() {
    super('Stored document size did not match its metadata');
    this.name = 'ObjectStorageSizeMismatchError';
  }
}

export class ObjectStorageDeleteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObjectStorageDeleteError';
  }
}
