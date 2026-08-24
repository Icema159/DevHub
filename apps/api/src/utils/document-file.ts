import { basename } from 'node:path';
import { createHash } from 'node:crypto';

import { AppError } from './app-error.js';

const PDF_SIGNATURE = Buffer.from('%PDF-');
const MAX_DOCUMENT_NAME_LENGTH = 255;

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127;
  });
}

export function validateDocumentName(originalName: string): string {
  const name = basename(originalName).trim();

  if (
    name.length === 0 ||
    name.length > MAX_DOCUMENT_NAME_LENGTH ||
    containsControlCharacter(name)
  ) {
    throw new AppError(400, 'INVALID_FILE_NAME', 'File name is invalid');
  }

  return name;
}

export function validatePdfContent(content: Buffer): void {
  if (content.length < PDF_SIGNATURE.length || !content.subarray(0, 5).equals(PDF_SIGNATURE)) {
    throw new AppError(415, 'INVALID_PDF', 'Uploaded file does not contain a valid PDF signature');
  }
}

export function calculateFileHash(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}
