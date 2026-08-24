import type { Server } from 'node:http';

import { app } from './app.js';
import { closeAuthRateLimitService } from './config/auth-rate-limiter.js';
import { env } from './config/env.js';
import { disconnectPrisma } from './config/prisma.js';
import { closeResourceRateLimitService } from './config/resource-rate-limiter.js';
import { closeDocumentDeletionQueue } from './queues/document-deletion.queue.js';
import { closeDocumentProcessingQueue } from './queues/document-processing.queue.js';

const server: Server = app.listen(env.port, '0.0.0.0', () => {
  console.log(`API listening on port ${env.port}`);
});

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`${signal} received, shutting down API`);

  server.close(async (serverError) => {
    const cleanupResults = await Promise.allSettled([
      closeAuthRateLimitService(),
      closeResourceRateLimitService(),
      closeDocumentDeletionQueue(),
      closeDocumentProcessingQueue(),
      disconnectPrisma(),
    ]);

    for (const result of cleanupResults) {
      if (result.status === 'rejected') {
        console.error('Failed to close an API resource cleanly', result.reason);
        process.exitCode = 1;
      }
    }

    if (serverError) {
      console.error('Failed to close HTTP server cleanly', serverError);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
