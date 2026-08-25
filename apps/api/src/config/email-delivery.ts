import { ConsoleEmailVerificationSender } from '../infrastructure/email/console-email-verification.sender.js';
import { ResendEmailVerificationSender } from '../infrastructure/email/resend-email-verification.sender.js';
import { SmtpEmailVerificationSender } from '../infrastructure/email/smtp-email-verification.sender.js';
import type { EmailVerificationSender } from '../services/email-verification-mail.service.js';
import { env } from './env.js';

let emailVerificationSender: EmailVerificationSender | undefined;

function createConfiguredSender(): EmailVerificationSender {
  if (env.emailDeliveryDriver === 'console') {
    return new ConsoleEmailVerificationSender(env.nodeEnv);
  }

  if (env.emailDeliveryDriver === 'resend') {
    return new ResendEmailVerificationSender({
      apiKey: env.resendApiKey!,
      from: env.emailFrom!,
    });
  }

  return new SmtpEmailVerificationSender({
    host: env.smtpHost!,
    port: env.smtpPort!,
    secure: env.smtpSecure!,
    from: env.smtpFrom!,
    ...(env.smtpUsername ? { username: env.smtpUsername } : {}),
    ...(env.smtpPassword ? { password: env.smtpPassword } : {}),
  });
}

export function getEmailVerificationSender(): EmailVerificationSender {
  emailVerificationSender ??= createConfiguredSender();
  return emailVerificationSender;
}

export function setEmailVerificationSenderForTests(
  sender: EmailVerificationSender | undefined,
): void {
  emailVerificationSender = sender;
}
