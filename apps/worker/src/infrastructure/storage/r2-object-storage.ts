import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

import {
  ObjectStorageDeleteError,
  ObjectStorageReadError,
  ObjectStorageSizeMismatchError,
  type ObjectStorage,
} from '../../services/object-storage.service.js';

export interface R2ObjectStorageReaderConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export class R2ObjectStorageReader implements ObjectStorage {
  private readonly client: S3Client;
  private readonly bucketName: string;

  constructor(config: R2ObjectStorageReaderConfig, client?: S3Client) {
    this.bucketName = config.bucketName;
    this.client =
      client ??
      new S3Client({
        region: 'auto',
        endpoint: config.endpoint,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
  }

  async downloadFile(storageKey: string, expectedSizeBytes: bigint): Promise<Buffer> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: storageKey,
        }),
      );

      if (!response.Body) {
        throw new ObjectStorageReadError('Stored document response did not contain a body');
      }

      if (
        response.ContentLength === undefined ||
        BigInt(response.ContentLength) !== expectedSizeBytes
      ) {
        if ('destroy' in response.Body && typeof response.Body.destroy === 'function') {
          response.Body.destroy();
        }

        throw new ObjectStorageSizeMismatchError();
      }

      const content = Buffer.from(await response.Body.transformToByteArray());

      if (BigInt(content.byteLength) !== expectedSizeBytes) {
        throw new ObjectStorageSizeMismatchError();
      }

      return content;
    } catch (error) {
      if (error instanceof ObjectStorageReadError) {
        throw error;
      }

      throw new ObjectStorageReadError('Stored document file could not be downloaded', {
        cause: error,
      });
    }
  }

  async deleteFile(storageKey: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: storageKey,
        }),
      );
    } catch {
      throw new ObjectStorageDeleteError('Stored document file could not be deleted');
    }
  }
}
