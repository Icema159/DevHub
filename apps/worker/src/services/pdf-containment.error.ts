import { NonRetryableDocumentProcessingError } from './document-processing.error.js';

export type PdfContainmentErrorCode =
  | 'PDF_PAGE_LIMIT_EXCEEDED'
  | 'PDF_TEXT_LIMIT_EXCEEDED'
  | 'PDF_CHUNK_LIMIT_EXCEEDED'
  | 'PDF_PROCESSING_TIMEOUT'
  | 'PDF_PROCESSING_CRASH'
  | 'PDF_STORED_FILE_INVALID';

export class PdfContainmentError extends NonRetryableDocumentProcessingError {
  constructor(code: PdfContainmentErrorCode, message: string, options?: ErrorOptions) {
    super(code, message, options);
    this.name = 'PdfContainmentError';
  }
}
