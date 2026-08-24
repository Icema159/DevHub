import {
  DOCUMENT_PROCESSING_JOB_NAME,
  DOCUMENT_PROCESSING_QUEUE_NAME,
  type DocumentProcessingJobData,
} from '@developer-knowledge-hub/shared/queue/document-processing';
import { createRedisConnectionOptions } from '@developer-knowledge-hub/shared/queue/redis-connection';
import { Queue } from 'bullmq';

import { env } from '../config/env.js';

type DocumentProcessingQueue = Queue<
  DocumentProcessingJobData,
  void,
  typeof DOCUMENT_PROCESSING_JOB_NAME
>;

export interface EnqueueDocumentProcessingOptions {
  jobId?: string;
}

let documentProcessingQueue: DocumentProcessingQueue | undefined;

export function getDocumentProcessingQueue(): DocumentProcessingQueue {
  if (documentProcessingQueue) {
    return documentProcessingQueue;
  }

  documentProcessingQueue = new Queue<
    DocumentProcessingJobData,
    void,
    typeof DOCUMENT_PROCESSING_JOB_NAME
  >(DOCUMENT_PROCESSING_QUEUE_NAME, {
    connection: createRedisConnectionOptions(env.redisUrl, 1),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        age: 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 24 * 3600,
        count: 5000,
      },
    },
  });

  documentProcessingQueue.on('error', (error) => {
    console.error('Document processing queue connection error', error);
  });

  return documentProcessingQueue;
}

export async function enqueueDocumentProcessing(
  data: DocumentProcessingJobData,
  options: EnqueueDocumentProcessingOptions = {},
): Promise<void> {
  await getDocumentProcessingQueue().add(DOCUMENT_PROCESSING_JOB_NAME, data, {
    jobId: options.jobId ?? `document-${data.documentId}`,
  });
}

export async function closeDocumentProcessingQueue(): Promise<void> {
  await documentProcessingQueue?.close();
  documentProcessingQueue = undefined;
}
