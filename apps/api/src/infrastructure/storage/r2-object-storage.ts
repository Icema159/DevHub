import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import {
  createDocumentStorageKey,
  type ObjectStorage,
  type UploadObjectInput,
} from '../../services/object-storage.service.js';

export interface R2ObjectStorageConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export class R2ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;
  private readonly bucketName: string;

  constructor(config: R2ObjectStorageConfig) {
    this.bucketName = config.bucketName;
    this.client = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async uploadFile(input: UploadObjectInput): Promise<string> {
    const storageKey = createDocumentStorageKey(input.userId);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey,
        Body: input.content,
        ContentType: input.mimeType,
      }),
    );

    return storageKey;
  }

  async deleteFile(storageKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey,
      }),
    );
  }
}
