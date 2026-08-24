import {
  DOCUMENT_DELETION_JOB_NAME,
  DOCUMENT_DELETION_QUEUE_NAME,
  type DocumentDeletionJobData,
} from '@developer-knowledge-hub/shared/queue/document-deletion';
import { createRedisConnectionOptions } from '@developer-knowledge-hub/shared/queue/redis-connection';
import { Queue } from 'bullmq';

import { env } from '../config/env.js';

type DocumentDeletionQueue = Queue<
  DocumentDeletionJobData,
  void,
  typeof DOCUMENT_DELETION_JOB_NAME
>;

let documentDeletionQueue: DocumentDeletionQueue | undefined;

export function getDocumentDeletionQueue(): DocumentDeletionQueue {
  if (documentDeletionQueue) {
    return documentDeletionQueue;
  }

  documentDeletionQueue = new Queue<
    DocumentDeletionJobData,
    void,
    typeof DOCUMENT_DELETION_JOB_NAME
  >(DOCUMENT_DELETION_QUEUE_NAME, {
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

  documentDeletionQueue.on('error', (error) => {
    console.error('Document deletion queue connection error', error);
  });

  return documentDeletionQueue;
}

export async function enqueueDocumentDeletion(data: DocumentDeletionJobData): Promise<void> {
  await getDocumentDeletionQueue().add(DOCUMENT_DELETION_JOB_NAME, data, {
    jobId: `deletion-${data.documentId}`,
  });
}

export async function closeDocumentDeletionQueue(): Promise<void> {
  await documentDeletionQueue?.close();
  documentDeletionQueue = undefined;
}
