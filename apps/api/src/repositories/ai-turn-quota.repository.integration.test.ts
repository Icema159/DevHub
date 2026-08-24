import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { AiTurnReservationStatus } from '../../../../generated/prisma/client.js';
import { RESOURCE_LIMITS } from '../config/resource-limits.js';
import { disconnectPrisma, prisma } from '../config/prisma.js';
import { releaseAiTurn, reserveAiTurn } from './ai-turn-quota.repository.js';

test('rolling AI-turn quota is owner-scoped, bounded, and concurrency-safe', async () => {
  const suffix = randomUUID();
  const userId = `turn-owner-${suffix}`;
  const foreignUserId = `turn-foreign-${suffix}`;
  const now = new Date('2035-04-10T12:00:00.000Z');

  try {
    await prisma.user.createMany({
      data: [
        { id: userId, email: `${userId}@example.com`, passwordHash: 'test-only' },
        { id: foreignUserId, email: `${foreignUserId}@example.com`, passwordHash: 'test-only' },
      ],
    });
    await prisma.aiTurnReservation.createMany({
      data: [
        ...Array.from({ length: RESOURCE_LIMITS.perUserAiTurns24Hours - 1 }, (_, index) => ({
          id: `turn-committed-${index}-${suffix}`,
          userId,
          status: AiTurnReservationStatus.COMMITTED,
          expiresAt: now,
          committedAt: new Date(now.getTime() - 60_000),
        })),
        {
          id: `turn-old-${suffix}`,
          userId,
          status: AiTurnReservationStatus.COMMITTED,
          expiresAt: now,
          committedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000 - 1),
        },
        {
          id: `turn-foreign-${suffix}`,
          userId: foreignUserId,
          status: AiTurnReservationStatus.COMMITTED,
          expiresAt: now,
          committedAt: now,
        },
      ],
    });

    const simultaneous = await Promise.all([
      reserveAiTurn(userId, now),
      reserveAiTurn(userId, now),
    ]);
    assert.equal(simultaneous.filter((decision) => decision.allowed).length, 1);
    assert.equal(simultaneous.filter((decision) => !decision.allowed).length, 1);

    const allowed = simultaneous.find((decision) => decision.allowed);
    if (allowed?.allowed) await releaseAiTurn(allowed.reservationId, userId);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [userId, foreignUserId] } } });
    await disconnectPrisma();
  }
});

test('expired AI-turn reservations are released lazily', async () => {
  const suffix = randomUUID();
  const userId = `turn-expired-${suffix}`;
  const now = new Date('2035-05-10T12:00:00.000Z');

  try {
    await prisma.user.create({
      data: { id: userId, email: `${userId}@example.com`, passwordHash: 'test-only' },
    });
    await prisma.aiTurnReservation.createMany({
      data: Array.from({ length: RESOURCE_LIMITS.perUserAiTurns24Hours }, (_, index) => ({
        id: `turn-expired-reservation-${index}-${suffix}`,
        userId,
        status: AiTurnReservationStatus.RESERVED,
        expiresAt: new Date(now.getTime() - 1),
      })),
    });

    const decision = await reserveAiTurn(userId, now);
    assert.equal(decision.allowed, true);
    if (decision.allowed) await releaseAiTurn(decision.reservationId, userId);
  } finally {
    await prisma.user.deleteMany({ where: { id: userId } });
    await disconnectPrisma();
  }
});
