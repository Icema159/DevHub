import { randomUUID } from 'node:crypto';

export interface UploadObjectInput {
  userId: string;
  content: Buffer;
  mimeType: string;
}

export interface ObjectStorage {
  uploadFile(input: UploadObjectInput): Promise<string>;
  deleteFile(storageKey: string): Promise<void>;
}

export function createDocumentStorageKey(userId: string): string {
  return `users/${userId}/documents/${randomUUID()}.pdf`;
}
