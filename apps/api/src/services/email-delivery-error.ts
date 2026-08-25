export type EmailDeliveryFailureCategory =
  | 'authentication_failure'
  | 'invalid_recipient'
  | 'invalid_sender'
  | 'malformed_request'
  | 'network_failure'
  | 'provider_rejection'
  | 'rate_limit'
  | 'unexpected_response';

interface EmailDeliveryErrorOptions {
  category: EmailDeliveryFailureCategory;
  provider: 'resend';
  providerCode?: string;
  statusCode?: number;
}

export class EmailDeliveryError extends Error {
  readonly category: EmailDeliveryFailureCategory;
  readonly provider: 'resend';
  readonly providerCode: string | undefined;
  readonly statusCode: number | undefined;

  constructor(options: EmailDeliveryErrorOptions) {
    super('Email delivery provider request failed');
    this.name = 'EmailDeliveryError';
    this.category = options.category;
    this.provider = options.provider;
    this.providerCode = options.providerCode;
    this.statusCode = options.statusCode;
  }
}

export function safeEmailDeliveryFailureMetadata(
  error: unknown,
): Readonly<Record<string, unknown>> {
  if (error instanceof EmailDeliveryError) {
    return {
      provider: error.provider,
      category: error.category,
      ...(error.providerCode ? { providerCode: error.providerCode } : {}),
      ...(error.statusCode === undefined ? {} : { statusCode: error.statusCode }),
    };
  }

  return {
    provider: 'unknown',
    category: 'unexpected_response',
  };
}

export function logEmailDeliveryFailure(event: string, error: unknown): void {
  console.error(event, safeEmailDeliveryFailureMetadata(error));
}
