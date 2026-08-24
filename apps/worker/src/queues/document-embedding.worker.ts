import {
  DOCUMENT_EMBEDDING_JOB_NAME,
  DOCUMENT_EMBEDDING_QUEUE_NAME,
  parseDocumentEmbeddingJobData,
  type DocumentEmbeddingJobData,
} from '@developer-knowledge-hub/shared/queue/document-embedding';
import { createRedisConnectionOptions } from '@developer-knowledge-hub/shared/queue/redis-connection';
import { DelayedError, type Job, UnrecoverableError, Worker } from 'bullmq';

import { env } from '../config/env.js';
import { NonRetryableDocumentProcessingError } from '../services/document-processing.error.js';
import { embeddingProcessingService } from '../services/embedding-processing.service.js';
import { WorkerAiBudgetUnavailableError } from '../services/ai-budget.service.js';
import { hasAutomaticAttemptsRemaining } from './job-attempts.js';

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Unknown document embedding error');
}

type DocumentEmbeddingWorkerService = Pick<
  typeof embeddingProcessingService,
  'processDocumentEmbeddings' | 'recordFinalFailure'
>;

export function createDocumentEmbeddingProcessor(
  service: DocumentEmbeddingWorkerService = embeddingProcessingService,
) {
  return async (job: Job<DocumentEmbeddingJobData, void, string>): Promise<void> => {
    if (job.name !== DOCUMENT_EMBEDDING_JOB_NAME) {
      throw new UnrecoverableError(`Unsupported job name: ${job.name}`);
    }

    let jobData: DocumentEmbeddingJobData;

    try {
      jobData = parseDocumentEmbeddingJobData(job.data);
    } catch (error) {
      throw new UnrecoverableError(normalizeError(error).message);
    }

    try {
      const result = await service.processDocumentEmbeddings(jobData);
      console.log('Document embedding completed', {
        jobId: job.id,
        documentId: jobData.documentId,
        outcome: result.outcome,
        embeddedChunkCount: result.embeddedChunkCount,
      });
    } catch (error) {
      if (error instanceof WorkerAiBudgetUnavailableError) {
        const retryAt = Math.max(error.retryAt.getTime(), Date.now() + 60_000);
        await job.moveToDelayed(retryAt, job.token);
        throw new DelayedError();
      }

      const isUnrecoverable = error instanceof NonRetryableDocumentProcessingError;

      if (isUnrecoverable || !hasAutomaticAttemptsRemaining(job)) {
        await service.recordFinalFailure(jobData);
      }

      if (isUnrecoverable) {
        throw new UnrecoverableError(`${error.code}: ${error.message}`);
      }

      throw normalizeError(error);
    }
  };
}

export function createDocumentEmbeddingWorker(): Worker<DocumentEmbeddingJobData, void, string> {
  const worker = new Worker<DocumentEmbeddingJobData, void, string>(
    DOCUMENT_EMBEDDING_QUEUE_NAME,
    createDocumentEmbeddingProcessor(),
    {
      connection: createRedisConnectionOptions(env.redisUrl, null),
      concurrency: env.embeddingWorkerConcurrency,
    },
  );

  worker.on('completed', (job) => {
    console.log('Document embedding job completed', {
      jobId: job.id,
      documentId: job.data.documentId,
    });
  });

  worker.on('failed', (job, error) => {
    console.error('Document embedding job failed', {
      jobId: job?.id,
      documentId: job?.data.documentId,
      attemptsMade: job?.attemptsMade,
      error,
    });
  });

  worker.on('error', (error) => {
    console.error('Document embedding worker error', error);
  });

  return worker;
}
