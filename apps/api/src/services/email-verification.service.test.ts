import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../utils/app-error.js';
import { hashOpaqueToken } from '../utils/secure-token.js';
import {
  createEmailVerificationService,
  EMAIL_VERIFICATION_TOKEN_LIFETIME_MS,
} from './email-verification.service.js';

const now = new Date('2026-08-18T10:00:00.000Z');

function fixture(options: { emailVerified?: boolean; validToken?: boolean } = {}) {
  const replacements: Array<{
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    invalidatedAt: Date;
  }> = [];
  const sent: Array<{ recipient: string; verificationUrl: string }> = [];
  const consumed: Array<{ tokenHash: string; verifiedAt: Date }> = [];

  return {
    replacements,
    sent,
    consumed,
    dependencies: {
      appBaseUrl: 'https://knowledge.example',
      async consumeToken(tokenHash: string, verifiedAt: Date) {
        consumed.push({ tokenHash, verifiedAt });

        return options.validToken === false
          ? null
          : {
              id: 'user-a',
              email: 'user-a@example.com',
              name: null,
              createdAt: now,
              emailVerified: true,
            };
      },
      async findUser() {
        return {
          id: 'user-a',
          email: 'user-a@example.com',
          name: null,
          createdAt: now,
          emailVerified: options.emailVerified ?? false,
        };
      },
      generateToken: () => 'a'.repeat(43),
      getSender: () => ({
        async sendVerificationEmail(input: { recipient: string; verificationUrl: string }) {
          sent.push(input);
        },
      }),
      hashToken: hashOpaqueToken,
      now: () => now,
      async replaceToken(
        userId: string,
        input: { tokenHash: string; expiresAt: Date },
        invalidatedAt: Date,
      ) {
        replacements.push({ userId, ...input, invalidatedAt });
      },
    },
  };
}

test('prepares a hashed 60-minute verification token without storing the raw token', () => {
  const testFixture = fixture();
  const service = createEmailVerificationService(testFixture.dependencies);
  const prepared = service.prepareVerificationToken();

  assert.equal(prepared.rawToken, 'a'.repeat(43));
  assert.equal(prepared.record.tokenHash, hashOpaqueToken(prepared.rawToken));
  assert.notEqual(prepared.record.tokenHash, prepared.rawToken);
  assert.equal(
    prepared.record.expiresAt.getTime() - now.getTime(),
    EMAIL_VERIFICATION_TOKEN_LIFETIME_MS,
  );
});

test('resend replaces outstanding state and sends a fragment-based trusted URL', async () => {
  const testFixture = fixture();
  const service = createEmailVerificationService(testFixture.dependencies);

  assert.deepEqual(await service.resendVerification('user-a'), { emailVerified: false });
  assert.equal(testFixture.replacements.length, 1);
  assert.equal(testFixture.replacements[0]?.userId, 'user-a');
  assert.deepEqual(testFixture.sent, [
    {
      recipient: 'user-a@example.com',
      verificationUrl: `https://knowledge.example/verify-email#token=${'a'.repeat(43)}`,
    },
  ]);
});

test('a verified user resend is a safe no-op', async () => {
  const testFixture = fixture({ emailVerified: true });
  const service = createEmailVerificationService(testFixture.dependencies);

  assert.deepEqual(await service.resendVerification('user-a'), { emailVerified: true });
  assert.equal(testFixture.replacements.length, 0);
  assert.equal(testFixture.sent.length, 0);
});

test('verification hashes the submitted bearer token and fails generically when unusable', async () => {
  const testFixture = fixture({ validToken: false });
  const service = createEmailVerificationService(testFixture.dependencies);

  await assert.rejects(
    () => service.verifyEmail('a'.repeat(43)),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 400 &&
      error.code === 'INVALID_OR_EXPIRED_VERIFICATION',
  );
  assert.deepEqual(testFixture.consumed, [
    { tokenHash: hashOpaqueToken('a'.repeat(43)), verifiedAt: now },
  ]);
});
