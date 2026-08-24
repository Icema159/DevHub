import {
  DOCUMENT_DELETION_JOB_NAME,
  DOCUMENT_DELETION_QUEUE_NAME,
  parseDocumentDeletionJobData,
  type DocumentDeletionJobData,
} from '@developer-knowledge-hub/shared/queue/document-deletion';
import { createRedisConnectionOptions } from '@developer-knowledge-hub/shared/queue/redis-connection';
import { type Job, UnrecoverableError, Worker } from 'bullmq';

import { env } from '../config/env.js';
import { documentDeletionService } from '../services/document-deletion.service.js';

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Unknown document cleanup error');
}

type DocumentDeletionWorkerService = Pick<typeof documentDeletionService, 'deleteDocument'>;

export function createDocumentDeletionProcessor(
  service: DocumentDeletionWorkerService = documentDeletionService,
) {
  return async (job: Job<DocumentDeletionJobData, void, string>): Promise<void> => {
    if (job.name !== DOCUMENT_DELETION_JOB_NAME) {
      throw new UnrecoverableError(`Unsupported job name: ${job.name}`);
    }

    let jobData: DocumentDeletionJobData;

    try {
      jobData = parseDocumentDeletionJobData(job.data);
    } catch (error) {
      throw new UnrecoverableError(normalizeError(error).message);
    }

    const result = await service.deleteDocument(jobData);
    console.log('Document cleanup completed', {
      jobId: job.id,
      documentId: jobData.documentId,
      outcome: result.outcome,
    });
  };
}

export function createDocumentDeletionWorker(): Worker<DocumentDeletionJobData, void, string> {
  const worker = new Worker<DocumentDeletionJobData, void, string>(
    DOCUMENT_DELETION_QUEUE_NAME,
    createDocumentDeletionProcessor(),
    {
      connection: createRedisConnectionOptions(env.redisUrl, null),
      concurrency: 1,
    },
  );

  worker.on('completed', (job) => {
    console.log('Document cleanup job completed', {
      jobId: job.id,
      documentId: job.data.documentId,
    });
  });

  worker.on('failed', (job, error) => {
    console.error('Document cleanup job failed', {
      jobId: job?.id,
      documentId: job?.data.documentId,
      attemptsMade: job?.attemptsMade,
      error: error.message,
    });
  });

  worker.on('error', (error) => {
    console.error('Document cleanup worker error', error.message);
  });

  return worker;
}
