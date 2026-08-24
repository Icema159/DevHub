import { disconnectPrisma } from './config/prisma.js';
import { closeDocumentEmbeddingQueue } from './queues/document-embedding.queue.js';
import { createDocumentEmbeddingWorker } from './queues/document-embedding.worker.js';
import { createDocumentDeletionWorker } from './queues/document-deletion.worker.js';
import { createDocumentProcessingWorker } from './queues/document-processing.worker.js';

const documentProcessingWorker = createDocumentProcessingWorker();
const documentEmbeddingWorker = createDocumentEmbeddingWorker();
const documentDeletionWorker = createDocumentDeletionWorker();

console.log('Document processing, embedding, and cleanup workers started');

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`${signal} received, shutting down worker`);

  const cleanupResults = await Promise.allSettled([
    documentProcessingWorker.close(),
    documentEmbeddingWorker.close(),
    documentDeletionWorker.close(),
    closeDocumentEmbeddingQueue(),
    disconnectPrisma(),
  ]);

  for (const result of cleanupResults) {
    if (result.status === 'rejected') {
      console.error('Failed to close a worker resource cleanly', result.reason);
      process.exitCode = 1;
    }
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
