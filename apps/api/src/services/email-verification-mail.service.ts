export interface SendVerificationEmailInput {
  recipient: string;
  verificationUrl: string;
}

export interface EmailVerificationSender {
  sendVerificationEmail(input: SendVerificationEmailInput): Promise<void>;
}

export const EMAIL_VERIFICATION_SUBJECT = 'Verify your Developer Knowledge Hub email';

export function buildEmailVerificationText(verificationUrl: string): string {
  return [
    'Verify your email to upload documents and use AI-powered search and chat.',
    '',
    verificationUrl,
    '',
    'This link expires in 60 minutes and can be used once.',
  ].join('\n');
}
