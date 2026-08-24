import { createHash, randomBytes } from 'node:crypto';

export const OPAQUE_TOKEN_BYTES = 32;

export function generateOpaqueToken(): string {
  return randomBytes(OPAQUE_TOKEN_BYTES).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
