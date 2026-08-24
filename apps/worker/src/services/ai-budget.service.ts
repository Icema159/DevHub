import type { GeneratedEmbedding } from '@developer-knowledge-hub/ai/embedding';
import {
  estimateEmbeddingReservationMicroUsd,
  estimateUsageMicroUsd,
} from '@developer-knowledge-hub/ai/pricing';
import {
  AiUsageSource,
  createAiBudgetRepository,
} from '@developer-knowledge-hub/shared/resource-guard/ai-budget';
import { AiOperation } from '../../../../generated/prisma/client.js';

import { env } from '../config/env.js';
import { getEmbeddingService } from '../config/embedding.js';
import { prisma } from '../config/prisma.js';

const RESERVATION_TTL_MS = 15 * 60 * 1000;

export class WorkerAiBudgetUnavailableError extends Error {
  constructor(readonly retryAt: Date) {
    super('AI budget is temporarily unavailable');
    this.name = 'WorkerAiBudgetUnavailableError';
  }
}

export interface PreparedDocumentEmbeddings {
  generate(): Promise<GeneratedEmbedding[]>;
  release(): Promise<void>;
}

const repository = createAiBudgetRepository(prisma, {
  monthlyLimitMicroUsd: env.globalOpenAiMonthlyBudgetMicroUsd,
  reservationTtlMs: RESERVATION_TTL_MS,
});

export const workerAiBudgetService = {
  async prepareDocumentEmbeddings(
    userId: string,
    texts: string[],
  ): Promise<PreparedDocumentEmbeddings> {
    const provider = 'openai';
    const model = env.openaiEmbeddingModel;
    const operation = AiOperation.DOCUMENT_EMBEDDING;
    const reservedMicroUsd = estimateEmbeddingReservationMicroUsd(provider, model, texts);
    const decision = await repository.reserve({
      userId,
      operation,
      provider,
      model,
      reservedMicroUsd,
    });

    if (!decision.allowed) throw new WorkerAiBudgetUnavailableError(decision.retryAt);

    let reconciled = false;

    return {
      async generate() {
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
          reconciled = true;

          for (const threshold of commit.warnings) {
            console.warn('OpenAI monthly budget threshold reached', {
              threshold,
              operation,
              model,
            });
          }

          return result.embeddings;
        } catch (error) {
          if (!reconciled) {
            await repository.commit({
              reservationId: decision.reservationId,
              estimatedMicroUsd: reservedMicroUsd,
              source: AiUsageSource.CONSERVATIVE_ESTIMATE,
            });
            reconciled = true;
          }
          throw error;
        }
      },

      async release() {
        if (!reconciled) {
          await repository.release(decision.reservationId);
          reconciled = true;
        }
      },
    };
  },
};
