import {
  DOCUMENT_EMBEDDING_JOB_NAME,
  DOCUMENT_EMBEDDING_QUEUE_NAME,
  type DocumentEmbeddingJobData,
} from '@developer-knowledge-hub/shared/queue/document-embedding';
import { createRedisConnectionOptions } from '@developer-knowledge-hub/shared/queue/redis-connection';
import { Queue } from 'bullmq';

import { env } from '../config/env.js';

type DocumentEmbeddingQueue = Queue<
  DocumentEmbeddingJobData,
  void,
  typeof DOCUMENT_EMBEDDING_JOB_NAME
>;

let documentEmbeddingQueue: DocumentEmbeddingQueue | undefined;

function getDocumentEmbeddingQueue(): DocumentEmbeddingQueue {
  if (documentEmbeddingQueue) {
    return documentEmbeddingQueue;
  }

  documentEmbeddingQueue = new Queue<
    DocumentEmbeddingJobData,
    void,
    typeof DOCUMENT_EMBEDDING_JOB_NAME
  >(DOCUMENT_EMBEDDING_QUEUE_NAME, {
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

  documentEmbeddingQueue.on('error', (error) => {
    console.error('Document embedding queue connection error', error);
  });

  return documentEmbeddingQueue;
}

export async function enqueueDocumentEmbedding(data: DocumentEmbeddingJobData): Promise<void> {
  await getDocumentEmbeddingQueue().add(DOCUMENT_EMBEDDING_JOB_NAME, data, {
    jobId: `embedding-${data.documentId}`,
  });
}

export async function closeDocumentEmbeddingQueue(): Promise<void> {
  await documentEmbeddingQueue?.close();
  documentEmbeddingQueue = undefined;
}
