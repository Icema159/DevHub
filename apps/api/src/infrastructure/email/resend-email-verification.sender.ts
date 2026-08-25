import { Resend } from 'resend';

import {
  buildEmailVerificationText,
  EMAIL_VERIFICATION_SUBJECT,
  type EmailVerificationSender,
  type SendVerificationEmailInput,
} from '../../services/email-verification-mail.service.js';
import {
  EmailDeliveryError,
  type EmailDeliveryFailureCategory,
} from '../../services/email-delivery-error.js';

interface ResendSendPayload {
  from: string;
  subject: string;
  text: string;
  to: string;
}

interface ResendSendResult {
  data: { id: string } | null;
  error: {
    message: string;
    name: string;
    statusCode: number | null;
  } | null;
}

export interface ResendEmailClient {
  send(payload: ResendSendPayload): Promise<ResendSendResult>;
}

export interface ResendEmailVerificationSenderOptions {
  apiKey: string;
  client?: ResendEmailClient;
  from: string;
}

function classifyProviderError(
  error: NonNullable<ResendSendResult['error']>,
): EmailDeliveryFailureCategory {
  if (['missing_api_key', 'restricted_api_key', 'invalid_api_key'].includes(error.name)) {
    return 'authentication_failure';
  }

  if (
    ['monthly_quota_exceeded', 'daily_quota_exceeded', 'rate_limit_exceeded'].includes(
      error.name,
    ) ||
    error.statusCode === 429
  ) {
    return 'rate_limit';
  }

  if (error.name === 'invalid_from_address') {
    return 'invalid_sender';
  }

  if (['validation_error', 'invalid_parameter', 'missing_required_field'].includes(error.name)) {
    const normalizedMessage = error.message.toLowerCase();

    if (/\b(from|sender|sending domain|domain)\b/.test(normalizedMessage)) {
      return 'invalid_sender';
    }

    if (/\b(recipient|recipient address|to address)\b/.test(normalizedMessage)) {
      return 'invalid_recipient';
    }

    return 'malformed_request';
  }

  return 'provider_rejection';
}

export class ResendEmailVerificationSender implements EmailVerificationSender {
  private readonly client: ResendEmailClient;
  private readonly from: string;

  constructor(options: ResendEmailVerificationSenderOptions) {
    this.from = options.from;

    if (options.client) {
      this.client = options.client;
      return;
    }

    const resend = new Resend(options.apiKey);
    this.client = {
      send: (payload) => resend.emails.send(payload),
    };
  }

  async sendVerificationEmail(input: SendVerificationEmailInput): Promise<void> {
    let result: ResendSendResult;

    try {
      result = await this.client.send({
        from: this.from,
        to: input.recipient,
        subject: EMAIL_VERIFICATION_SUBJECT,
        text: buildEmailVerificationText(input.verificationUrl),
      });
    } catch {
      throw new EmailDeliveryError({
        provider: 'resend',
        category: 'network_failure',
      });
    }

    if (result.error) {
      throw new EmailDeliveryError({
        provider: 'resend',
        category: classifyProviderError(result.error),
        providerCode: result.error.name,
        ...(result.error.statusCode === null ? {} : { statusCode: result.error.statusCode }),
      });
    }

    if (!result.data?.id) {
      throw new EmailDeliveryError({
        provider: 'resend',
        category: 'unexpected_response',
      });
    }
  }
}
