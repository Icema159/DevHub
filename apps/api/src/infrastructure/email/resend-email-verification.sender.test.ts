import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EmailDeliveryError,
  safeEmailDeliveryFailureMetadata,
} from '../../services/email-delivery-error.js';
import {
  ResendEmailVerificationSender,
  type ResendEmailClient,
} from './resend-email-verification.sender.js';

const apiKey = 're_secret-that-must-never-be-logged';
const recipient = 'developer@example.com';
const verificationUrl = 'https://hub.example.com/verify-email#token=secret-token';

test('Resend sender preserves the verification email payload and accepts a successful response', async () => {
  const deliveries: Parameters<ResendEmailClient['send']>[0][] = [];
  const client: ResendEmailClient = {
    async send(payload) {
      deliveries.push(payload);
      return { data: { id: 'email-id' }, error: null };
    },
  };
  const sender = new ResendEmailVerificationSender({
    apiKey,
    client,
    from: 'Developer Knowledge Hub <onboarding@resend.dev>',
  });

  await sender.sendVerificationEmail({ recipient, verificationUrl });

  assert.deepEqual(deliveries, [
    {
      from: 'Developer Knowledge Hub <onboarding@resend.dev>',
      to: recipient,
      subject: 'Verify your Developer Knowledge Hub email',
      text: [
        'Verify your email to upload documents and use AI-powered search and chat.',
        '',
        verificationUrl,
        '',
        'This link expires in 60 minutes and can be used once.',
      ].join('\n'),
    },
  ]);
});

test('Resend returned errors are converted into classified delivery failures', async () => {
  const sender = new ResendEmailVerificationSender({
    apiKey,
    from: 'Developer Knowledge Hub <onboarding@resend.dev>',
    client: {
      async send() {
        return {
          data: null,
          error: {
            name: 'invalid_from_address',
            message: 'The from address is invalid',
            statusCode: 422,
          },
        };
      },
    },
  });

  await assert.rejects(
    () => sender.sendVerificationEmail({ recipient, verificationUrl }),
    (error) =>
      error instanceof EmailDeliveryError &&
      error.category === 'invalid_sender' &&
      error.providerCode === 'invalid_from_address' &&
      error.statusCode === 422,
  );
});

test('Resend authentication, recipient, and rate errors have distinct safe categories', async (t) => {
  const cases = [
    {
      name: 'invalid_api_key',
      message: 'Invalid API key',
      statusCode: 403,
      expected: 'authentication_failure',
    },
    {
      name: 'validation_error',
      message: 'Recipient is invalid',
      statusCode: 400,
      expected: 'invalid_recipient',
    },
    {
      name: 'rate_limit_exceeded',
      message: 'Too many requests',
      statusCode: 429,
      expected: 'rate_limit',
    },
  ] as const;

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const sender = new ResendEmailVerificationSender({
        apiKey,
        from: 'Developer Knowledge Hub <onboarding@resend.dev>',
        client: {
          async send() {
            return { data: null, error: testCase };
          },
        },
      });

      await assert.rejects(
        () => sender.sendVerificationEmail({ recipient, verificationUrl }),
        (error) => error instanceof EmailDeliveryError && error.category === testCase.expected,
      );
    });
  }
});

test('Resend thrown errors become safe network failures without retaining secrets', async () => {
  const sender = new ResendEmailVerificationSender({
    apiKey,
    from: 'Developer Knowledge Hub <onboarding@resend.dev>',
    client: {
      async send() {
        throw new Error(`${apiKey} ${recipient} ${verificationUrl}`);
      },
    },
  });

  const error = await sender
    .sendVerificationEmail({ recipient, verificationUrl })
    .then(() => null)
    .catch((caught: unknown) => caught);

  assert.ok(error instanceof EmailDeliveryError);
  assert.equal(error.category, 'network_failure');
  const serialized = JSON.stringify(safeEmailDeliveryFailureMetadata(error));
  assert.equal(serialized.includes(apiKey), false);
  assert.equal(serialized.includes(recipient), false);
  assert.equal(serialized.includes('secret-token'), false);
});

test('Resend response without an error or accepted email ID fails safely', async () => {
  const sender = new ResendEmailVerificationSender({
    apiKey,
    from: 'Developer Knowledge Hub <onboarding@resend.dev>',
    client: {
      async send() {
        return { data: null, error: null };
      },
    },
  });

  await assert.rejects(
    () => sender.sendVerificationEmail({ recipient, verificationUrl }),
    (error) => error instanceof EmailDeliveryError && error.category === 'unexpected_response',
  );
});
