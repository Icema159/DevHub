import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { AiOperation, AiUsageSource } from '../../../../generated/prisma/client.js';
import { createAiBudgetRepository } from '@developer-knowledge-hub/shared/resource-guard/ai-budget';
import { disconnectPrisma, prisma } from '../config/prisma.js';

function monthStart(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

async function cleanPeriod(periodStart: Date): Promise<void> {
  const reservations = await prisma.aiBudgetReservation.findMany({
    where: { periodStart },
    select: { id: true },
  });
  await prisma.aiUsageRecord.deleteMany({
    where: { reservationId: { in: reservations.map((reservation) => reservation.id) } },
  });
  await prisma.aiBudgetReservation.deleteMany({ where: { periodStart } });
  await prisma.aiBudgetPeriod.deleteMany({ where: { periodStart } });
}

test('global budget reservations enforce atomic monthly limits and bounded warnings', async () => {
  const now = new Date('2041-01-10T12:00:00.000Z');
  const periodStart = monthStart(now);
  const repository = createAiBudgetRepository(prisma, {
    monthlyLimitMicroUsd: 100n,
    reservationTtlMs: 60_000,
  });

  try {
    const first = await repository.reserve({
      operation: AiOperation.ANSWER_GENERATION,
      provider: 'openai',
      model: 'gpt-5.6-sol',
      reservedMicroUsd: 60n,
      now,
    });
    assert.equal(first.allowed, true);
    assert.equal(
      (
        await repository.reserve({
          operation: AiOperation.DOCUMENT_EMBEDDING,
          provider: 'openai',
          model: 'text-embedding-3-small',
          reservedMicroUsd: 50n,
          now,
        })
      ).allowed,
      false,
    );
    assert.ok(first.allowed);
    const firstCommit = await repository.commit({
      reservationId: first.reservationId,
      estimatedMicroUsd: 60n,
      source: AiUsageSource.PROVIDER_REPORTED,
      inputTokens: 12,
      outputTokens: 2,
      totalTokens: 14,
      now,
    });
    assert.deepEqual(firstCommit.warnings, [50]);

    const second = await repository.reserve({
      operation: AiOperation.TITLE_GENERATION,
      provider: 'openai',
      model: 'gpt-5.6-sol',
      reservedMicroUsd: 20n,
      now,
    });
    assert.ok(second.allowed);
    const secondCommit = await repository.commit({
      reservationId: second.reservationId,
      estimatedMicroUsd: 20n,
      source: AiUsageSource.CONSERVATIVE_ESTIMATE,
      now,
    });
    assert.deepEqual(secondCommit.warnings, [80]);

    const period = await prisma.aiBudgetPeriod.findUniqueOrThrow({ where: { periodStart } });
    assert.equal(period.committedMicroUsd, 80n);
    assert.equal(period.reservedMicroUsd, 0n);
    assert.ok(period.warning50At);
    assert.ok(period.warning80At);
  } finally {
    await cleanPeriod(periodStart);
    await disconnectPrisma();
  }
});

test('global budget is shared across users, rejects concurrent oversubscription, and expires stale holds', async () => {
  const suffix = randomUUID();
  const userAId = `budget-a-${suffix}`;
  const userBId = `budget-b-${suffix}`;
  const now = new Date('2041-02-10T12:00:00.000Z');
  const periodStart = monthStart(now);
  const repository = createAiBudgetRepository(prisma, {
    monthlyLimitMicroUsd: 100n,
    reservationTtlMs: 1_000,
  });

  try {
    await prisma.user.createMany({
      data: [
        { id: userAId, email: `${userAId}@example.com`, passwordHash: 'test-only' },
        { id: userBId, email: `${userBId}@example.com`, passwordHash: 'test-only' },
      ],
    });

    const concurrent = await Promise.all(
      [userAId, userBId, userAId].map((userId) =>
        repository.reserve({
          userId,
          operation: AiOperation.QUESTION_EMBEDDING,
          provider: 'openai',
          model: 'text-embedding-3-small',
          reservedMicroUsd: 40n,
          now,
        }),
      ),
    );
    assert.equal(concurrent.filter((decision) => decision.allowed).length, 2);
    assert.equal(concurrent.filter((decision) => !decision.allowed).length, 1);

    for (const decision of concurrent) {
      if (decision.allowed) await repository.release(decision.reservationId);
    }

    const stale = await repository.reserve({
      userId: userAId,
      operation: AiOperation.DOCUMENT_EMBEDDING,
      provider: 'openai',
      model: 'text-embedding-3-small',
      reservedMicroUsd: 90n,
      now,
    });
    assert.ok(stale.allowed);
    const afterExpiry = await repository.reserve({
      userId: userBId,
      operation: AiOperation.ANSWER_GENERATION,
      provider: 'openai',
      model: 'gpt-5.6-sol',
      reservedMicroUsd: 90n,
      now: new Date(now.getTime() + 1_001),
    });
    assert.ok(afterExpiry.allowed);
    if (afterExpiry.allowed) await repository.release(afterExpiry.reservationId);
  } finally {
    await cleanPeriod(periodStart);
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await disconnectPrisma();
  }
});
