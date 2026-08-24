export class NonRetryableDocumentProcessingError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'NonRetryableDocumentProcessingError';
    this.code = code;
  }
}
