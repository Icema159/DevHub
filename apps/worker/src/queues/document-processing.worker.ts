import {
  DOCUMENT_PROCESSING_JOB_NAME,
  DOCUMENT_PROCESSING_QUEUE_NAME,
  parseDocumentProcessingJobData,
  type DocumentProcessingJobData,
} from '@developer-knowledge-hub/shared/queue/document-processing';
import { createRedisConnectionOptions } from '@developer-knowledge-hub/shared/queue/redis-connection';
import { type Job, UnrecoverableError, Worker } from 'bullmq';

import { env } from '../config/env.js';
import { documentProcessingService } from '../services/document-processing.service.js';
import { NonRetryableDocumentProcessingError } from '../services/document-processing.error.js';
import { hasAutomaticAttemptsRemaining } from './job-attempts.js';

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Unknown document processing error');
}

type DocumentProcessingWorkerService = Pick<
  typeof documentProcessingService,
  'processDocument' | 'recordFinalFailure'
>;

export function createDocumentProcessingProcessor(
  service: DocumentProcessingWorkerService = documentProcessingService,
) {
  return async (job: Job<DocumentProcessingJobData, void, string>): Promise<void> => {
    if (job.name !== DOCUMENT_PROCESSING_JOB_NAME) {
      throw new UnrecoverableError(`Unsupported job name: ${job.name}`);
    }

    let jobData: DocumentProcessingJobData;

    try {
      jobData = parseDocumentProcessingJobData(job.data);
    } catch (error) {
      throw new UnrecoverableError(normalizeError(error).message);
    }

    try {
      const result = await service.processDocument(jobData);
      console.log('Document processing completed', {
        jobId: job.id,
        documentId: jobData.documentId,
        outcome: result.outcome,
        chunkCount: result.chunkCount,
      });
    } catch (error) {
      const isUnrecoverable = error instanceof NonRetryableDocumentProcessingError;

      if (isUnrecoverable || !hasAutomaticAttemptsRemaining(job)) {
        await service.recordFinalFailure(jobData, error);
      }

      if (isUnrecoverable) {
        throw new UnrecoverableError(`${error.code}: ${error.message}`);
      }

      throw normalizeError(error);
    }
  };
}

export function createDocumentProcessingWorker(): Worker<DocumentProcessingJobData, void, string> {
  const worker = new Worker<DocumentProcessingJobData, void, string>(
    DOCUMENT_PROCESSING_QUEUE_NAME,
    createDocumentProcessingProcessor(),
    {
      connection: createRedisConnectionOptions(env.redisUrl, null),
      concurrency: env.documentWorkerConcurrency,
    },
  );

  worker.on('completed', (job) => {
    console.log('Document processing job completed', {
      jobId: job.id,
      documentId: job.data.documentId,
    });
  });

  worker.on('failed', (job, error) => {
    console.error('Document processing job failed', {
      jobId: job?.id,
      documentId: job?.data.documentId,
      attemptsMade: job?.attemptsMade,
      error,
    });
  });

  worker.on('error', (error) => {
    console.error('Document processing worker error', error);
  });

  return worker;
}
