import type {
  ChatGenerationInput,
  ChatGenerationStreamEvent,
  ChatGenerationStreamOptions,
  GeneratedChatAnswer,
} from '@developer-knowledge-hub/ai/chat-generation';
import type { GeneratedEmbedding } from '@developer-knowledge-hub/ai/embedding';
import {
  estimateChatReservationMicroUsd,
  estimateEmbeddingReservationMicroUsd,
  estimateUsageMicroUsd,
} from '@developer-knowledge-hub/ai/pricing';
import {
  AiUsageSource,
  createAiBudgetRepository,
} from '@developer-knowledge-hub/shared/resource-guard/ai-budget';
import { AiOperation } from '../../../../generated/prisma/client.js';

import { env } from '../config/env.js';
import { getChatGenerationService } from '../config/chat-generation.js';
import { getEmbeddingService } from '../config/embedding.js';
import { RESOURCE_LIMITS } from '../config/resource-limits.js';
import { prisma } from '../config/prisma.js';

export class AiBudgetUnavailableError extends Error {
  constructor(readonly retryAt: Date) {
    super('AI budget is temporarily unavailable');
    this.name = 'AiBudgetUnavailableError';
  }
}

const repository = createAiBudgetRepository(prisma, {
  monthlyLimitMicroUsd: env.globalOpenAiMonthlyBudgetMicroUsd,
  reservationTtlMs: RESOURCE_LIMITS.aiBudgetReservationTtlMs,
});

function logWarnings(operation: AiOperation, model: string, warnings: Array<50 | 80>): void {
  for (const threshold of warnings) {
    console.warn('OpenAI monthly budget threshold reached', { threshold, operation, model });
  }
}

async function commitConservative(
  reservationId: string,
  reservedMicroUsd: bigint,
  operation: AiOperation,
  model: string,
): Promise<void> {
  const result = await repository.commit({
    reservationId,
    estimatedMicroUsd: reservedMicroUsd,
    source: AiUsageSource.CONSERVATIVE_ESTIMATE,
  });
  logWarnings(operation, model, result.warnings);
}

async function commitChatUsage(
  reservationId: string,
  reservedMicroUsd: bigint,
  operation: AiOperation,
  provider: string,
  model: string,
  answer: GeneratedChatAnswer,
): Promise<void> {
  const usage = answer.usage;
  const commit = usage
    ? await repository.commit({
        reservationId,
        estimatedMicroUsd: estimateUsageMicroUsd(provider, model, usage),
        source: AiUsageSource.PROVIDER_REPORTED,
        inputTokens: usage.inputTokens,
        ...(usage.cachedInputTokens === undefined
          ? {}
          : { cachedInputTokens: usage.cachedInputTokens }),
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
      })
    : await repository.commit({
        reservationId,
        estimatedMicroUsd: reservedMicroUsd,
        source: AiUsageSource.CONSERVATIVE_ESTIMATE,
      });
  logWarnings(operation, answer.model, commit.warnings);
}

export const aiBudgetService = {
  async generateEmbeddings(
    userId: string,
    operation: 'QUESTION_EMBEDDING',
    texts: string[],
  ): Promise<GeneratedEmbedding[]> {
    const provider = 'openai';
    const model = env.openaiEmbeddingModel;
    const reservedMicroUsd = estimateEmbeddingReservationMicroUsd(provider, model, texts);
    const decision = await repository.reserve({
      userId,
      operation,
      provider,
      model,
      reservedMicroUsd,
    });

    if (!decision.allowed) throw new AiBudgetUnavailableError(decision.retryAt);

    try {
      const result = await getEmbeddingService().generateEmbeddingsWithUsage(texts);
      const usage = result.usage;
      const commit = usage
        ? await repository.commit({
            reservationId: decision.reservationId,
            estimatedMicroUsd: estimateUsageMicroUsd(provider, model, {
              inputTokens: usage.inputTokens,
              totalTokens: usage.totalTokens,
            }),
            source: AiUsageSource.PROVIDER_REPORTED,
            inputTokens: usage.inputTokens,
            totalTokens: usage.totalTokens,
          })
        : await repository.commit({
            reservationId: decision.reservationId,
            estimatedMicroUsd: reservedMicroUsd,
            source: AiUsageSource.CONSERVATIVE_ESTIMATE,
          });
      logWarnings(operation, model, commit.warnings);
      return result.embeddings;
    } catch (error) {
      await commitConservative(decision.reservationId, reservedMicroUsd, operation, model);
      throw error;
    }
  },

  async generateChatAnswer(
    userId: string,
    operation: 'ANSWER_GENERATION' | 'TITLE_GENERATION',
    input: ChatGenerationInput,
    maxOutputTokens = env.openaiChatMaxOutputTokens,
  ): Promise<GeneratedChatAnswer> {
    const provider = 'openai';
    const model = env.openaiChatModel;
    const reservedMicroUsd = estimateChatReservationMicroUsd(
      provider,
      model,
      JSON.stringify(input),
      maxOutputTokens,
    );
    const decision = await repository.reserve({
      userId,
      operation,
      provider,
      model,
      reservedMicroUsd,
    });

    if (!decision.allowed) throw new AiBudgetUnavailableError(decision.retryAt);

    try {
      const answer = await getChatGenerationService(maxOutputTokens).generateAnswer(input);
      await commitChatUsage(
        decision.reservationId,
        reservedMicroUsd,
        operation,
        provider,
        model,
        answer,
      );
      return answer;
    } catch (error) {
      await commitConservative(decision.reservationId, reservedMicroUsd, operation, model);
      throw error;
    }
  },

  async *streamChatAnswer(
    userId: string,
    operation: 'ANSWER_GENERATION',
    input: ChatGenerationInput,
    options: ChatGenerationStreamOptions = {},
  ): AsyncGenerator<ChatGenerationStreamEvent> {
    const provider = 'openai';
    const model = env.openaiChatModel;
    const maxOutputTokens = env.openaiChatMaxOutputTokens;
    const reservedMicroUsd = estimateChatReservationMicroUsd(
      provider,
      model,
      JSON.stringify(input),
      maxOutputTokens,
    );
    const decision = await repository.reserve({
      userId,
      operation,
      provider,
      model,
      reservedMicroUsd,
    });

    if (!decision.allowed) throw new AiBudgetUnavailableError(decision.retryAt);

    let reservationSettled = false;

    try {
      for await (const event of getChatGenerationService(maxOutputTokens).streamAnswer(
        input,
        options,
      )) {
        if (event.type === 'completed') {
          await commitChatUsage(
            decision.reservationId,
            reservedMicroUsd,
            operation,
            provider,
            model,
            event.result,
          );
          reservationSettled = true;
        }

        yield event;
      }
    } catch (error) {
      if (!reservationSettled) {
        await commitConservative(decision.reservationId, reservedMicroUsd, operation, model);
        reservationSettled = true;
      }
      throw error;
    } finally {
      if (!reservationSettled) {
        await commitConservative(decision.reservationId, reservedMicroUsd, operation, model);
      }
    }
  },
};
