import { env } from '../config/env.js';
import { getEmailVerificationSender } from '../config/email-delivery.js';
import {
  consumeVerificationToken,
  replaceOutstandingVerificationToken,
  type VerificationTokenRecordInput,
} from '../repositories/email-verification.repository.js';
import { findUserById, type SafeUser } from '../repositories/user.repository.js';
import { AppError } from '../utils/app-error.js';
import { generateOpaqueToken, hashOpaqueToken } from '../utils/secure-token.js';
import { logEmailDeliveryFailure } from './email-delivery-error.js';
import type { EmailVerificationSender } from './email-verification-mail.service.js';

export const EMAIL_VERIFICATION_TOKEN_LIFETIME_MS = 60 * 60 * 1000;

export interface PreparedVerificationToken {
  rawToken: string;
  record: VerificationTokenRecordInput;
}

interface EmailVerificationServiceDependencies {
  appBaseUrl: string;
  consumeToken(tokenHash: string, verifiedAt: Date): Promise<SafeUser | null>;
  findUser(userId: string): Promise<SafeUser | null>;
  generateToken(): string;
  getSender(): EmailVerificationSender;
  hashToken(token: string): string;
  now(): Date;
  replaceToken(
    userId: string,
    input: VerificationTokenRecordInput,
    invalidatedAt: Date,
  ): Promise<void>;
}

const defaultDependencies: EmailVerificationServiceDependencies = {
  appBaseUrl: env.appBaseUrl,
  consumeToken: consumeVerificationToken,
  findUser: findUserById,
  generateToken: generateOpaqueToken,
  getSender: getEmailVerificationSender,
  hashToken: hashOpaqueToken,
  now: () => new Date(),
  replaceToken: replaceOutstandingVerificationToken,
};

function invalidVerificationError(): AppError {
  return new AppError(
    400,
    'INVALID_OR_EXPIRED_VERIFICATION',
    'This verification link is invalid or has expired',
  );
}

function verificationEmailUnavailableError(): AppError {
  return new AppError(
    503,
    'VERIFICATION_EMAIL_UNAVAILABLE',
    'Verification email could not be sent. Try again later',
  );
}

export function createEmailVerificationService(
  dependencies: EmailVerificationServiceDependencies = defaultDependencies,
) {
  function prepareVerificationToken(): PreparedVerificationToken {
    const rawToken = dependencies.generateToken();
    const now = dependencies.now();

    return {
      rawToken,
      record: {
        tokenHash: dependencies.hashToken(rawToken),
        expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TOKEN_LIFETIME_MS),
      },
    };
  }

  async function deliverVerificationEmail(email: string, rawToken: string): Promise<void> {
    const verificationUrl = `${dependencies.appBaseUrl}/verify-email#token=${encodeURIComponent(rawToken)}`;
    await dependencies.getSender().sendVerificationEmail({
      recipient: email,
      verificationUrl,
    });
  }

  return {
    prepareVerificationToken,
    deliverVerificationEmail,

    async verifyEmail(rawToken: string): Promise<void> {
      const user = await dependencies.consumeToken(
        dependencies.hashToken(rawToken),
        dependencies.now(),
      );

      if (!user) {
        throw invalidVerificationError();
      }
    },

    async resendVerification(userId: string): Promise<{ emailVerified: boolean }> {
      const user = await dependencies.findUser(userId);

      if (!user) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
      }

      if (user.emailVerified) {
        return { emailVerified: true };
      }

      const preparedToken = prepareVerificationToken();
      await dependencies.replaceToken(user.id, preparedToken.record, dependencies.now());

      try {
        await deliverVerificationEmail(user.email, preparedToken.rawToken);
      } catch (error) {
        logEmailDeliveryFailure('Verification email delivery failed', error);
        throw verificationEmailUnavailableError();
      }

      return { emailVerified: false };
    },
  };
}

export const emailVerificationService = createEmailVerificationService();
