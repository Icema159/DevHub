import { prisma } from '../config/prisma.js';

export interface ActiveSessionRecord {
  emailVerified: boolean;
  sessionId: string;
  userEmail: string;
  userId: string;
}

export interface CreateSessionInput {
  expiresAt: Date;
  tokenHash: string;
  userId: string;
}

export async function createSession(input: CreateSessionInput): Promise<void> {
  await prisma.session.create({
    data: input,
    select: { id: true },
  });
}

export async function findActiveSessionByTokenHash(
  tokenHash: string,
  now: Date,
): Promise<ActiveSessionRecord | null> {
  const session = await prisma.session.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    select: {
      id: true,
      user: {
        select: {
          id: true,
          email: true,
          emailVerifiedAt: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  return {
    sessionId: session.id,
    userId: session.user.id,
    userEmail: session.user.email,
    emailVerified: session.user.emailVerifiedAt !== null,
  };
}

export async function revokeSession(
  sessionId: string,
  userId: string,
  revokedAt: Date,
): Promise<boolean> {
  const result = await prisma.session.updateMany({
    where: {
      id: sessionId,
      userId,
      revokedAt: null,
    },
    data: { revokedAt },
  });

  return result.count === 1;
}

export async function revokeAllSessionsForUser(userId: string, revokedAt: Date): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: { revokedAt },
  });

  return result.count;
}
