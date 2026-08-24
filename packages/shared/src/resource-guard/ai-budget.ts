import {
  AiBudgetReservationStatus,
  type AiOperation,
  AiUsageSource,
  Prisma,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';

export interface AiBudgetPolicy {
  monthlyLimitMicroUsd: bigint;
  reservationTtlMs: number;
}

export interface AiBudgetReservationInput {
  userId?: string;
  operation: AiOperation;
  provider: string;
  model: string;
  reservedMicroUsd: bigint;
  now?: Date;
}

export type AiBudgetReservationDecision =
  { allowed: true; reservationId: string } | { allowed: false; retryAt: Date };

export interface AiBudgetUsageInput {
  reservationId: string;
  estimatedMicroUsd: bigint;
  source: AiUsageSource;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  now?: Date;
}

export interface AiBudgetCommitResult {
  committed: boolean;
  warnings: Array<50 | 80>;
}

function utcMonthStart(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function nextUtcMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1));
}

async function lockPeriod(transaction: Prisma.TransactionClient, periodStart: Date): Promise<void> {
  await transaction.$queryRaw(
    Prisma.sql`SELECT "periodStart" FROM "AiBudgetPeriod" WHERE "periodStart" = ${periodStart} FOR UPDATE`,
  );
}

async function reconcileExpiredReservations(
  transaction: Prisma.TransactionClient,
  periodStart: Date,
  now: Date,
): Promise<void> {
  const expired = await transaction.aiBudgetReservation.findMany({
    where: {
      periodStart,
      status: AiBudgetReservationStatus.RESERVED,
      expiresAt: { lte: now },
    },
    select: { id: true, reservedMicroUsd: true },
  });

  if (expired.length === 0) return;

  await transaction.aiBudgetReservation.updateMany({
    where: { id: { in: expired.map((reservation) => reservation.id) } },
    data: { status: AiBudgetReservationStatus.RELEASED },
  });

  const period = await transaction.aiBudgetPeriod.findUniqueOrThrow({
    where: { periodStart },
    select: { reservedMicroUsd: true },
  });
  const released = expired.reduce((total, reservation) => total + reservation.reservedMicroUsd, 0n);

  await transaction.aiBudgetPeriod.update({
    where: { periodStart },
    data: {
      reservedMicroUsd:
        period.reservedMicroUsd > released ? period.reservedMicroUsd - released : 0n,
    },
  });
}

export function createAiBudgetRepository(prisma: PrismaClient, policy: AiBudgetPolicy) {
  if (policy.monthlyLimitMicroUsd <= 0n || policy.reservationTtlMs <= 0) {
    throw new Error('AI budget policy values must be positive');
  }

  return {
    async reserve(input: AiBudgetReservationInput): Promise<AiBudgetReservationDecision> {
      if (input.reservedMicroUsd <= 0n) {
        throw new Error('AI budget reservation must be positive');
      }

      const now = input.now ?? new Date();
      const periodStart = utcMonthStart(now);

      return prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw(
          Prisma.sql`INSERT INTO "AiBudgetPeriod" ("periodStart", "createdAt", "updatedAt")
            VALUES (${periodStart}, ${now}, ${now})
            ON CONFLICT ("periodStart") DO NOTHING`,
        );
        await lockPeriod(transaction, periodStart);
        await reconcileExpiredReservations(transaction, periodStart, now);

        const period = await transaction.aiBudgetPeriod.findUniqueOrThrow({
          where: { periodStart },
          select: { committedMicroUsd: true, reservedMicroUsd: true },
        });
        const projected =
          period.committedMicroUsd + period.reservedMicroUsd + input.reservedMicroUsd;

        if (projected > policy.monthlyLimitMicroUsd) {
          const earliestReservation = await transaction.aiBudgetReservation.findFirst({
            where: {
              periodStart,
              status: AiBudgetReservationStatus.RESERVED,
              expiresAt: { gt: now },
            },
            orderBy: { expiresAt: 'asc' },
            select: { expiresAt: true },
          });

          return {
            allowed: false as const,
            retryAt:
              period.committedMicroUsd + input.reservedMicroUsd > policy.monthlyLimitMicroUsd
                ? nextUtcMonth(now)
                : (earliestReservation?.expiresAt ?? nextUtcMonth(now)),
          };
        }

        const reservation = await transaction.aiBudgetReservation.create({
          data: {
            periodStart,
            userId: input.userId ?? null,
            operation: input.operation,
            provider: input.provider,
            model: input.model,
            reservedMicroUsd: input.reservedMicroUsd,
            expiresAt: new Date(now.getTime() + policy.reservationTtlMs),
          },
          select: { id: true },
        });
        await transaction.aiBudgetPeriod.update({
          where: { periodStart },
          data: { reservedMicroUsd: { increment: input.reservedMicroUsd } },
        });

        return { allowed: true as const, reservationId: reservation.id };
      });
    },

    async commit(input: AiBudgetUsageInput): Promise<AiBudgetCommitResult> {
      const now = input.now ?? new Date();

      return prisma.$transaction(async (transaction) => {
        const reservation = await transaction.aiBudgetReservation.findUnique({
          where: { id: input.reservationId },
        });

        if (!reservation || reservation.status !== AiBudgetReservationStatus.RESERVED) {
          return { committed: false, warnings: [] };
        }

        await lockPeriod(transaction, reservation.periodStart);
        const current = await transaction.aiBudgetReservation.findUniqueOrThrow({
          where: { id: reservation.id },
        });

        if (current.status !== AiBudgetReservationStatus.RESERVED) {
          return { committed: false, warnings: [] };
        }

        const period = await transaction.aiBudgetPeriod.findUniqueOrThrow({
          where: { periodStart: current.periodStart },
        });
        const committedMicroUsd = period.committedMicroUsd + input.estimatedMicroUsd;
        const reservedMicroUsd =
          period.reservedMicroUsd > current.reservedMicroUsd
            ? period.reservedMicroUsd - current.reservedMicroUsd
            : 0n;
        const warnings: Array<50 | 80> = [];
        const threshold50 = (policy.monthlyLimitMicroUsd * 50n) / 100n;
        const threshold80 = (policy.monthlyLimitMicroUsd * 80n) / 100n;
        const warning50At = period.warning50At ?? (committedMicroUsd >= threshold50 ? now : null);
        const warning80At = period.warning80At ?? (committedMicroUsd >= threshold80 ? now : null);

        if (!period.warning50At && warning50At) warnings.push(50);
        if (!period.warning80At && warning80At) warnings.push(80);

        await transaction.aiBudgetReservation.update({
          where: { id: current.id },
          data: { status: AiBudgetReservationStatus.COMMITTED },
        });
        await transaction.aiUsageRecord.create({
          data: {
            reservationId: current.id,
            userId: current.userId,
            operation: current.operation,
            provider: current.provider,
            model: current.model,
            estimatedMicroUsd: input.estimatedMicroUsd,
            source: input.source,
            inputTokens: input.inputTokens ?? null,
            cachedInputTokens: input.cachedInputTokens ?? null,
            outputTokens: input.outputTokens ?? null,
            totalTokens: input.totalTokens ?? null,
            createdAt: now,
          },
        });
        await transaction.aiBudgetPeriod.update({
          where: { periodStart: current.periodStart },
          data: {
            committedMicroUsd,
            reservedMicroUsd,
            warning50At,
            warning80At,
          },
        });

        return { committed: true, warnings };
      });
    },

    async release(reservationId: string): Promise<boolean> {
      return prisma.$transaction(async (transaction) => {
        const reservation = await transaction.aiBudgetReservation.findUnique({
          where: { id: reservationId },
        });

        if (!reservation || reservation.status !== AiBudgetReservationStatus.RESERVED) return false;

        await lockPeriod(transaction, reservation.periodStart);
        const current = await transaction.aiBudgetReservation.findUniqueOrThrow({
          where: { id: reservation.id },
        });

        if (current.status !== AiBudgetReservationStatus.RESERVED) return false;

        const period = await transaction.aiBudgetPeriod.findUniqueOrThrow({
          where: { periodStart: current.periodStart },
          select: { reservedMicroUsd: true },
        });
        await transaction.aiBudgetReservation.update({
          where: { id: current.id },
          data: { status: AiBudgetReservationStatus.RELEASED },
        });
        await transaction.aiBudgetPeriod.update({
          where: { periodStart: current.periodStart },
          data: {
            reservedMicroUsd:
              period.reservedMicroUsd > current.reservedMicroUsd
                ? period.reservedMicroUsd - current.reservedMicroUsd
                : 0n,
          },
        });

        return true;
      });
    },
  };
}

export { AiUsageSource };
