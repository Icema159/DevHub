import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import type { S3Client } from '@aws-sdk/client-s3';

import { LocalObjectStorageReader } from '../infrastructure/storage/local-object-storage.js';
import { R2ObjectStorageReader } from '../infrastructure/storage/r2-object-storage.js';
import { ObjectStorageSizeMismatchError } from './object-storage.service.js';

test('checks local object metadata before returning file content', async () => {
  const rootPath = await mkdtemp(join(tmpdir(), 'knowledge-hub-storage-'));
  const content = Buffer.from('%PDF-local-storage-test');

  try {
    await writeFile(join(rootPath, 'document.pdf'), content);
    const storage = new LocalObjectStorageReader(rootPath);

    await assert.rejects(
      () => storage.downloadFile('document.pdf', BigInt(content.byteLength + 1)),
      ObjectStorageSizeMismatchError,
    );
    assert.deepEqual(
      await storage.downloadFile('document.pdf', BigInt(content.byteLength)),
      content,
    );
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

test('rejects an R2 ContentLength mismatch before buffering the response body', async () => {
  let destroyed = false;
  let buffered = false;
  const client = {
    async send() {
      return {
        ContentLength: 100,
        Body: {
          destroy() {
            destroyed = true;
          },
          async transformToByteArray() {
            buffered = true;
            return Uint8Array.from(Buffer.from('%PDF-r2-test'));
          },
        },
      };
    },
  } as unknown as S3Client;
  const storage = new R2ObjectStorageReader(
    {
      endpoint: 'https://example.invalid',
      accessKeyId: 'test',
      secretAccessKey: 'test',
      bucketName: 'test',
    },
    client,
  );

  await assert.rejects(() => storage.downloadFile('document.pdf', 9n), {
    name: 'ObjectStorageSizeMismatchError',
  });
  assert.equal(destroyed, true);
  assert.equal(buffered, false);
});
