import nodemailer, { type Transporter } from 'nodemailer';

import type {
  EmailVerificationSender,
  SendVerificationEmailInput,
} from '../../services/email-verification-mail.service.js';

export interface SmtpEmailVerificationSenderOptions {
  from: string;
  host: string;
  password?: string;
  port: number;
  secure: boolean;
  username?: string;
}

export class SmtpEmailVerificationSender implements EmailVerificationSender {
  private readonly from: string;
  private readonly transporter: Transporter;

  constructor(options: SmtpEmailVerificationSenderOptions) {
    this.from = options.from;
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      disableFileAccess: true,
      disableUrlAccess: true,
      ...(options.username && options.password
        ? {
            auth: {
              user: options.username,
              pass: options.password,
            },
          }
        : {}),
    });
  }

  async sendVerificationEmail(input: SendVerificationEmailInput): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: input.recipient,
      subject: 'Verify your Developer Knowledge Hub email',
      text: [
        'Verify your email to upload documents and use AI-powered search and chat.',
        '',
        input.verificationUrl,
        '',
        'This link expires in 60 minutes and can be used once.',
      ].join('\n'),
    });
  }
}
