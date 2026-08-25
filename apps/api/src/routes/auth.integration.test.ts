import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import test from 'node:test';

import { app } from '../app.js';
import { AUTH_COOKIE_NAME, SESSION_LIFETIME_MS } from '../config/auth-cookie.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../config/auth-rate-limit.js';
import { closeAuthRateLimitService, getAuthRateLimitService } from '../config/auth-rate-limiter.js';
import { disconnectPrisma, prisma } from '../config/prisma.js';
import { setEmailVerificationSenderForTests } from '../config/email-delivery.js';
import { revokeAllUserSessions } from '../services/session.service.js';
import type {
  EmailVerificationSender,
  SendVerificationEmailInput,
} from '../services/email-verification-mail.service.js';
import { generateOpaqueToken, hashOpaqueToken } from '../utils/secure-token.js';
import { createTestRequestHeaders } from '../test/auth-session.js';
import { EmailDeliveryError } from '../services/email-delivery-error.js';

interface ApiResponse {
  body: unknown;
  headers: Headers;
  status: number;
}

class CaptureEmailSender implements EmailVerificationSender {
  readonly deliveries: SendVerificationEmailInput[] = [];

  async sendVerificationEmail(input: SendVerificationEmailInput): Promise<void> {
    this.deliveries.push(input);
  }
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('listening', resolve);
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function cookieFrom(response: ApiResponse): string {
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie);
  return setCookie.split(';')[0] ?? '';
}

function verificationTokenFrom(delivery: SendVerificationEmailInput): string {
  const url = new URL(delivery.verificationUrl);
  const token = new URLSearchParams(url.hash.slice(1)).get('token');
  assert.ok(token);
  return token;
}

test('server sessions, verification, revocation, and privileged gates work end to end', async () => {
  const suffix = randomUUID();
  const email = `phase-13b1-${suffix}@example.com`;
  const deliveryFailureEmail = `phase-resend-failure-${suffix}@example.com`;
  const password = 'correct horse battery staple';
  const captureSender = new CaptureEmailSender();
  const server = app.listen(0, '127.0.0.1');
  let userId = '';

  setEmailVerificationSenderForTests(captureSender);
  await listen(server);
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function request(
    path: string,
    options: { body?: unknown; cookie?: string; method?: string } = {},
  ): Promise<ApiResponse> {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...createTestRequestHeaders(options.cookie),
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });

    return {
      status: response.status,
      headers: response.headers,
      body: response.status === 204 ? null : ((await response.json()) as unknown),
    };
  }

  try {
    const registration = await request('/api/auth/register', {
      method: 'POST',
      body: { email: ` ${email.toUpperCase()} `, password },
    });
    assert.equal(registration.status, 202);
    assert.deepEqual(registration.body, {
      data: { status: 'VERIFICATION_REQUIRED' },
    });
    assert.equal(registration.headers.get('set-cookie'), null);
    assert.equal(JSON.stringify(registration.body).includes(email), false);
    assert.equal(captureSender.deliveries.length, 1);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { emailVerificationTokens: true },
    });
    assert.ok(user);
    userId = user.id;
    assert.equal(user.emailVerifiedAt, null);
    assert.equal(user.emailVerificationTokens.length, 1);

    const initialRawToken = verificationTokenFrom(captureSender.deliveries[0]!);
    assert.equal(user.emailVerificationTokens[0]?.tokenHash, hashOpaqueToken(initialRawToken));
    assert.equal(JSON.stringify(user.emailVerificationTokens).includes(initialRawToken), false);

    const duplicateRegistration = await request('/api/auth/register', {
      method: 'POST',
      body: { email, password: 'different-password' },
    });
    assert.equal(duplicateRegistration.status, registration.status);
    assert.deepEqual(duplicateRegistration.body, registration.body);
    assert.equal(captureSender.deliveries.length, 1);

    const invalidLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password: 'wrong-password' },
    });
    assert.deepEqual(invalidLogin.body, {
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    });

    const firstLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    const firstCookie = cookieFrom(firstLogin);
    assert.equal(firstLogin.status, 200);
    assert.match(firstCookie, new RegExp(`^${AUTH_COOKIE_NAME}=`));
    assert.match(firstLogin.headers.get('set-cookie') ?? '', /HttpOnly/i);
    assert.match(firstLogin.headers.get('set-cookie') ?? '', /SameSite=Lax/i);
    assert.deepEqual(firstLogin.body, {
      user: {
        id: userId,
        email,
        name: null,
        emailVerified: false,
        createdAt: user.createdAt.toISOString(),
      },
    });

    const firstRawSessionToken = firstCookie.slice(firstCookie.indexOf('=') + 1);
    const storedSession = await prisma.session.findUnique({
      where: { tokenHash: hashOpaqueToken(firstRawSessionToken) },
    });
    assert.ok(storedSession);
    assert.notEqual(storedSession.tokenHash, firstRawSessionToken);
    assert.ok(
      Math.abs(
        storedSession.expiresAt.getTime() - storedSession.createdAt.getTime() - SESSION_LIFETIME_MS,
      ) < 2_000,
    );

    const secondLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    const secondCookie = cookieFrom(secondLogin);
    assert.notEqual(firstCookie, secondCookie);
    assert.equal(await prisma.session.count({ where: { userId, revokedAt: null } }), 2);

    const meUnverified = await request('/api/auth/me', { cookie: secondCookie });
    assert.equal(meUnverified.status, 200);
    assert.equal(
      (meUnverified.body as { user: { emailVerified: boolean } }).user.emailVerified,
      false,
    );

    const gatedRequests = [
      request('/api/documents', { method: 'POST', cookie: secondCookie }),
      request('/api/documents/missing/retry', { method: 'POST', cookie: secondCookie }),
      request('/api/search', {
        method: 'POST',
        cookie: secondCookie,
        body: { query: 'What is authentication?' },
      }),
      request('/api/conversations/missing/messages', {
        method: 'POST',
        cookie: secondCookie,
        body: { content: 'What is authentication?' },
      }),
    ];

    for (const gatedResponse of await Promise.all(gatedRequests)) {
      assert.equal(gatedResponse.status, 403);
      assert.deepEqual(gatedResponse.body, {
        error: {
          code: 'EMAIL_VERIFICATION_REQUIRED',
          message: 'Verify your email before using this feature',
        },
      });
    }

    const resend = await request('/api/auth/resend-verification', {
      method: 'POST',
      cookie: secondCookie,
    });
    assert.equal(resend.status, 200);
    assert.deepEqual(resend.body, { data: { status: 'VERIFICATION_SENT' } });
    assert.equal(captureSender.deliveries.length, 2);
    const replacementRawToken = verificationTokenFrom(captureSender.deliveries[1]!);

    const superseded = await request('/api/auth/verify-email', {
      method: 'POST',
      body: { token: initialRawToken },
    });
    assert.equal(superseded.status, 400);
    assert.equal(
      (superseded.body as { error: { code: string } }).error.code,
      'INVALID_OR_EXPIRED_VERIFICATION',
    );

    const verified = await request('/api/auth/verify-email', {
      method: 'POST',
      body: { token: replacementRawToken },
    });
    assert.equal(verified.status, 200);
    assert.deepEqual(verified.body, { data: { status: 'VERIFIED' } });

    const reused = await request('/api/auth/verify-email', {
      method: 'POST',
      body: { token: replacementRawToken },
    });
    assert.equal(reused.status, 400);

    const meVerified = await request('/api/auth/me', { cookie: secondCookie });
    assert.equal(
      (meVerified.body as { user: { emailVerified: boolean } }).user.emailVerified,
      true,
    );

    const verifiedResend = await request('/api/auth/resend-verification', {
      method: 'POST',
      cookie: secondCookie,
    });
    assert.deepEqual(verifiedResend.body, { data: { status: 'ALREADY_VERIFIED' } });
    assert.equal(captureSender.deliveries.length, 2);

    const logout = await request('/api/auth/logout', {
      method: 'POST',
      cookie: firstCookie,
    });
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get('set-cookie') ?? '', /Expires=Thu, 01 Jan 1970/i);
    assert.equal((await request('/api/auth/me', { cookie: firstCookie })).status, 401);
    assert.equal((await request('/api/auth/me', { cookie: secondCookie })).status, 200);

    assert.equal(await revokeAllUserSessions(userId), 1);
    assert.equal((await request('/api/auth/me', { cookie: secondCookie })).status, 401);

    const expiredRawToken = generateOpaqueToken();
    await prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: hashOpaqueToken(expiredRawToken),
        expiresAt: new Date(Date.now() - 1_000),
      },
    });
    const expired = await request('/api/auth/verify-email', {
      method: 'POST',
      body: { token: expiredRawToken },
    });
    assert.equal(expired.status, 400);

    const logged: unknown[][] = [];
    const originalConsoleError = console.error;
    setEmailVerificationSenderForTests({
      async sendVerificationEmail() {
        throw new EmailDeliveryError({
          provider: 'resend',
          category: 'network_failure',
        });
      },
    });
    console.error = (...arguments_: unknown[]) => logged.push(arguments_);

    try {
      const registrationWithDeliveryFailure = await request('/api/auth/register', {
        method: 'POST',
        body: { email: deliveryFailureEmail, password },
      });
      assert.equal(registrationWithDeliveryFailure.status, 202);
      assert.deepEqual(registrationWithDeliveryFailure.body, {
        data: { status: 'VERIFICATION_REQUIRED' },
      });
    } finally {
      console.error = originalConsoleError;
      setEmailVerificationSenderForTests(captureSender);
    }

    assert.deepEqual(logged, [
      [
        'Initial verification email delivery failed',
        { provider: 'resend', category: 'network_failure' },
      ],
    ]);
    assert.equal(JSON.stringify(logged).includes(deliveryFailureEmail), false);
  } finally {
    const rateLimiter = getAuthRateLimitService();
    const ipSubjects = ['127.0.0.1', '::ffff:127.0.0.1'];

    for (const ip of ipSubjects) {
      await rateLimiter.reset(AUTH_RATE_LIMIT_POLICIES.registrationIp, ip);
      await rateLimiter.reset(AUTH_RATE_LIMIT_POLICIES.loginIp, ip);
      await rateLimiter.reset(AUTH_RATE_LIMIT_POLICIES.resendIp, ip);
      await rateLimiter.reset(AUTH_RATE_LIMIT_POLICIES.verificationIp, ip);
    }

    await rateLimiter.reset(AUTH_RATE_LIMIT_POLICIES.loginIdentity, email);
    if (userId) {
      await rateLimiter.reset(AUTH_RATE_LIMIT_POLICIES.resendUser, userId);
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.user.deleteMany({ where: { email: deliveryFailureEmail } });

    setEmailVerificationSenderForTests(undefined);
    await closeServer(server);
    await closeAuthRateLimitService();
    await disconnectPrisma();
  }
});
