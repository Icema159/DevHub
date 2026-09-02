import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { AiBudgetReservationStatus, AiUsageSource } from '../../../../generated/prisma/client.js';
import { getChatGenerationService } from '../config/chat-generation.js';
import { disconnectPrisma, prisma } from '../config/prisma.js';
import { aiBudgetService } from './ai-budget.service.js';

// aiBudgetService.streamChatAnswer wraps the real, shared monthly-budget
// repository (Postgres-backed) around whatever OpenAI Responses API stream
// getChatGenerationService() produces. There is no dependency-injection seam
// for either the repository or the provider on this service -- and adding
// one would be a redesign of the budget system, which this ticket explicitly
// rules out. Instead this test reaches into the *provider's* OpenAI client
// the same way packages/ai/src/openai-chat-generation.provider.test.ts
// already does (a type-cast into the private `client` field, then swapping
// `client.responses.create`), one layer further in: through the cached
// ChatGenerationService singleton's private `provider`. That keeps the real
// reservation/commit/conservative-estimate control flow under test exactly
// as production runs it, with only the network-bound OpenAI call replaced.
//
// This still requires a reachable Postgres (the same one every other
// *.integration.test.ts in this package needs) -- it is not itself a new
// requirement.

type ResponsesCreate = (...args: unknown[]) => Promise<unknown>;

function patchResponsesCreate(implementation: ResponsesCreate): () => void {
  const service = getChatGenerationService();
  const provider = (
    service as unknown as {
      provider: { client: { responses: { create: ResponsesCreate } } };
    }
  ).provider;
  const original = provider.client.responses.create;
  provider.client.responses.create = implementation;

  return () => {
    provider.client.responses.create = original;
  };
}

function fakeInput() {
  return {
    systemInstructions: 'Use retrieved sources for facts.',
    context: '[S1] Refunds are processed within 5 business days.',
    userQuestion: 'How long does a refund take?',
  };
}

async function latestReservation(userId: string) {
  return prisma.aiBudgetReservation.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { usageRecord: true },
  });
}

test('aiBudgetService.streamChatAnswer settles the shared budget reservation correctly', async (context) => {
  const suffix = randomUUID();
  const userId = `ai-budget-stream-user-${suffix}`;

  await prisma.user.create({
    data: {
      id: userId,
      email: `${userId}@example.com`,
      passwordHash: 'test-only',
      emailVerifiedAt: new Date(),
    },
  });

  try {
    await context.test(
      'commits provider-reported usage exactly once on a successful stream',
      async () => {
        const restore = patchResponsesCreate(async () => ({
          async *[Symbol.asyncIterator]() {
            yield { type: 'response.output_text.delta', delta: 'Refunds take ' };
            yield { type: 'response.output_text.delta', delta: 'five business days.' };
            yield {
              type: 'response.completed',
              response: {
                model: 'gpt-test',
                usage: {
                  input_tokens: 40,
                  output_tokens: 6,
                  total_tokens: 46,
                  input_tokens_details: { cached_tokens: 0 },
                  output_tokens_details: { reasoning_tokens: 0 },
                },
              },
            };
          },
        }));

        try {
          const events = [];

          for await (const event of aiBudgetService.streamChatAnswer(
            userId,
            'ANSWER_GENERATION',
            fakeInput(),
          )) {
            events.push(event);
          }

          assert.deepEqual(
            events.map((event) => event.type),
            ['delta', 'delta', 'completed'],
          );

          const reservation = await latestReservation(userId);
          assert.ok(reservation, 'expected a budget reservation row for this user');
          assert.equal(reservation.status, AiBudgetReservationStatus.COMMITTED);
          assert.ok(reservation.usageRecord, 'expected a linked usage record');
          assert.equal(reservation.usageRecord?.source, AiUsageSource.PROVIDER_REPORTED);
          assert.equal(reservation.usageRecord?.inputTokens, 40);
          assert.equal(reservation.usageRecord?.outputTokens, 6);
          assert.equal(reservation.usageRecord?.totalTokens, 46);
        } finally {
          restore();
        }
      },
    );

    await context.test(
      'commits a conservative estimate when the provider stream fails before completing',
      async () => {
        const restore = patchResponsesCreate(async () => ({
          async *[Symbol.asyncIterator]() {
            yield { type: 'response.output_text.delta', delta: 'Refunds ' };
            throw new Error('simulated provider disconnect mid-stream');
          },
        }));

        try {
          await assert.rejects(async () => {
            for await (const event of aiBudgetService.streamChatAnswer(
              userId,
              'ANSWER_GENERATION',
              fakeInput(),
            )) {
              void event;
              // Consume until the simulated failure surfaces.
            }
          }, /simulated provider disconnect mid-stream/);

          const reservation = await latestReservation(userId);
          assert.ok(reservation);
          assert.equal(reservation.status, AiBudgetReservationStatus.COMMITTED);
          assert.ok(reservation.usageRecord);
          assert.equal(reservation.usageRecord?.source, AiUsageSource.CONSERVATIVE_ESTIMATE);
          assert.equal(reservation.usageRecord?.estimatedMicroUsd, reservation.reservedMicroUsd);
        } finally {
          restore();
        }
      },
    );

    await context.test(
      'commits a conservative estimate exactly once when the consumer disconnects early',
      async () => {
        const restore = patchResponsesCreate(async () => ({
          async *[Symbol.asyncIterator]() {
            yield { type: 'response.output_text.delta', delta: 'Refunds take ' };
            yield { type: 'response.output_text.delta', delta: 'five business days.' };
            yield {
              type: 'response.completed',
              response: {
                model: 'gpt-test',
                usage: {
                  input_tokens: 40,
                  output_tokens: 6,
                  total_tokens: 46,
                  input_tokens_details: { cached_tokens: 0 },
                  output_tokens_details: { reasoning_tokens: 0 },
                },
              },
            };
          },
        }));

        try {
          const stream = aiBudgetService.streamChatAnswer(userId, 'ANSWER_GENERATION', fakeInput());
          const first = await stream.next();
          assert.equal(first.done, false);
          assert.equal(first.value?.type, 'delta');

          // Mirrors what the real HTTP layer does on client disconnect --
          // see conversation.controller.ts's response.once('close', ...)
          // handler and the resulting stream.return(undefined) -- without
          // ever reaching the generator's own 'completed' branch.
          await stream.return(undefined);

          const reservation = await latestReservation(userId);
          assert.ok(reservation);
          assert.equal(reservation.status, AiBudgetReservationStatus.COMMITTED);
          assert.ok(reservation.usageRecord);
          assert.equal(reservation.usageRecord?.source, AiUsageSource.CONSERVATIVE_ESTIMATE);

          // The unique constraint on AiUsageRecord.reservationId means a
          // double-commit (once from a catch block, once from finally) would
          // have surfaced as an unhandled rejection above rather than
          // silently succeeding -- this test reaching here at all is part of
          // the assertion that streamChatAnswer's `reservationSettled` guard
          // works.
        } finally {
          restore();
        }
      },
    );

    // Reservation-rejected (budget exhausted) behavior is intentionally not
    // re-exercised here: it is already covered thoroughly at the repository
    // layer by ai-budget.repository.integration.test.ts ("rejects concurrent
    // oversubscription"), and aiBudgetService.streamChatAnswer's handling of
    // it is a single, trivial guard (`if (!decision.allowed) throw new
    // AiBudgetUnavailableError(...)`) with no additional state to settle.
    // Deterministically exhausting the *real* shared global monthly budget
    // from a test would risk disrupting concurrent usage of this same
    // process-wide singleton, which is worse than the coverage gained.
  } finally {
    const reservations = await prisma.aiBudgetReservation.findMany({
      where: { userId },
      select: { id: true },
    });
    await prisma.aiUsageRecord.deleteMany({
      where: { reservationId: { in: reservations.map((reservation) => reservation.id) } },
    });
    await prisma.aiBudgetReservation.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await disconnectPrisma();
  }
});
