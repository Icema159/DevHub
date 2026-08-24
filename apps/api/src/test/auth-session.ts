import { randomUUID } from 'node:crypto';

import { SESSION_LIFETIME_MS, AUTH_COOKIE_NAME } from '../config/auth-cookie.js';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { csrfTokenForSession } from '../middleware/csrf.js';
import { generateOpaqueToken, hashOpaqueToken } from '../utils/secure-token.js';

export interface TestSession {
  cookieHeader: string;
  expiresAt: Date;
  sessionId: string;
  token: string;
  tokenHash: string;
}

export function createTestRequestHeaders(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) {
    return { origin: env.corsOrigin };
  }

  const token = cookieHeader.slice(cookieHeader.indexOf('=') + 1);

  return {
    origin: env.corsOrigin,
    cookie: cookieHeader,
    'x-csrf-token': csrfTokenForSession(token),
  };
}

export async function createTestSession(
  userId: string,
  options: {
    expiresAt?: Date;
    revokedAt?: Date | null;
    token?: string;
  } = {},
): Promise<TestSession> {
  const token = options.token ?? generateOpaqueToken();
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = options.expiresAt ?? new Date(Date.now() + SESSION_LIFETIME_MS);
  const session = await prisma.session.create({
    data: {
      id: `test-session-${randomUUID()}`,
      userId,
      tokenHash,
      expiresAt,
      revokedAt: options.revokedAt ?? null,
    },
    select: { id: true },
  });

  return {
    sessionId: session.id,
    token,
    tokenHash,
    expiresAt,
    cookieHeader: `${AUTH_COOKIE_NAME}=${token}`,
  };
}
