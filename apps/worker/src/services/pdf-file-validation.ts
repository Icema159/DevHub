import { PdfContainmentError } from './pdf-containment.error.js';

const PDF_SIGNATURE = Buffer.from('%PDF-', 'ascii');

export function validateStoredPdf(content: Buffer, expectedSizeBytes: bigint): void {
  const hasExpectedSize = BigInt(content.byteLength) === expectedSizeBytes;
  const hasPdfSignature =
    content.byteLength >= PDF_SIGNATURE.byteLength &&
    content.subarray(0, PDF_SIGNATURE.byteLength).equals(PDF_SIGNATURE);

  if (!hasExpectedSize || !hasPdfSignature) {
    throw new PdfContainmentError(
      'PDF_STORED_FILE_INVALID',
      'The stored PDF could not be validated safely',
    );
  }
}
