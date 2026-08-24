import { prisma } from '../config/prisma.js';
import type { SafeUser } from './user.repository.js';

export interface VerificationTokenRecordInput {
  expiresAt: Date;
  tokenHash: string;
}

export async function replaceOutstandingVerificationToken(
  userId: string,
  input: VerificationTokenRecordInput,
  invalidatedAt: Date,
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await transaction.emailVerificationToken.updateMany({
      where: {
        userId,
        usedAt: null,
      },
      data: { usedAt: invalidatedAt },
    });

    await transaction.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
      select: { id: true },
    });
  });
}

export async function consumeVerificationToken(
  tokenHash: string,
  verifiedAt: Date,
): Promise<SafeUser | null> {
  return prisma.$transaction(async (transaction) => {
    const token = await transaction.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        usedAt: true,
        expiresAt: true,
      },
    });

    if (!token || token.usedAt || token.expiresAt <= verifiedAt) {
      return null;
    }

    const claimed = await transaction.emailVerificationToken.updateMany({
      where: {
        id: token.id,
        usedAt: null,
        expiresAt: { gt: verifiedAt },
      },
      data: { usedAt: verifiedAt },
    });

    if (claimed.count !== 1) {
      return null;
    }

    const user = await transaction.user.update({
      where: { id: token.userId },
      data: {
        emailVerifiedAt: verifiedAt,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    await transaction.emailVerificationToken.updateMany({
      where: {
        userId: token.userId,
        usedAt: null,
      },
      data: { usedAt: verifiedAt },
    });

    return {
      ...user,
      emailVerified: true,
    };
  });
}
