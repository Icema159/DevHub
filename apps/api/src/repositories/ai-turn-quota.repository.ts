import { AiTurnReservationStatus } from '../../../../generated/prisma/client.js';

import { RESOURCE_LIMITS } from '../config/resource-limits.js';
import { prisma } from '../config/prisma.js';
import { lockQuotaOwner } from './resource-quota.repository.js';

export type AiTurnReservationDecision =
  { allowed: true; reservationId: string } | { allowed: false };

export async function reserveAiTurn(
  userId: string,
  now = new Date(),
): Promise<AiTurnReservationDecision> {
  return prisma.$transaction(async (transaction) => {
    if (!(await lockQuotaOwner(transaction, userId))) return { allowed: false as const };

    await transaction.aiTurnReservation.deleteMany({
      where: {
        userId,
        status: AiTurnReservationStatus.RESERVED,
        expiresAt: { lte: now },
      },
    });

    const rollingWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [committed, reserved] = await Promise.all([
      transaction.aiTurnReservation.count({
        where: {
          userId,
          status: AiTurnReservationStatus.COMMITTED,
          committedAt: { gt: rollingWindowStart },
        },
      }),
      transaction.aiTurnReservation.count({
        where: {
          userId,
          status: AiTurnReservationStatus.RESERVED,
          expiresAt: { gt: now },
        },
      }),
    ]);

    if (committed + reserved >= RESOURCE_LIMITS.perUserAiTurns24Hours) {
      return { allowed: false as const };
    }

    const reservation = await transaction.aiTurnReservation.create({
      data: {
        userId,
        expiresAt: new Date(now.getTime() + RESOURCE_LIMITS.aiTurnReservationTtlMs),
      },
      select: { id: true },
    });

    return { allowed: true as const, reservationId: reservation.id };
  });
}

export async function commitAiTurn(
  reservationId: string,
  userId: string,
  committedAt = new Date(),
): Promise<boolean> {
  const result = await prisma.aiTurnReservation.updateMany({
    where: {
      id: reservationId,
      userId,
      status: AiTurnReservationStatus.RESERVED,
    },
    data: { status: AiTurnReservationStatus.COMMITTED, committedAt },
  });

  return result.count === 1;
}

export async function releaseAiTurn(reservationId: string, userId: string): Promise<void> {
  await prisma.aiTurnReservation.deleteMany({
    where: {
      id: reservationId,
      userId,
      status: AiTurnReservationStatus.RESERVED,
    },
  });
}
