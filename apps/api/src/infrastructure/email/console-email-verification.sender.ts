import type {
  EmailVerificationSender,
  SendVerificationEmailInput,
} from '../../services/email-verification-mail.service.js';

export class ConsoleEmailVerificationSender implements EmailVerificationSender {
  constructor(nodeEnvironment: string) {
    if (nodeEnvironment === 'production') {
      throw new Error('Development console email delivery is disabled in production');
    }
  }

  async sendVerificationEmail(input: SendVerificationEmailInput): Promise<void> {
    console.info('Development email verification link', {
      recipient: input.recipient,
      verificationUrl: input.verificationUrl,
    });
  }
}
