export interface SendVerificationEmailInput {
  recipient: string;
  verificationUrl: string;
}

export interface EmailVerificationSender {
  sendVerificationEmail(input: SendVerificationEmailInput): Promise<void>;
}
