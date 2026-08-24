export interface JobAttemptState {
  attemptsMade: number;
  opts: {
    attempts?: number;
  };
}

function configuredAttempts(job: JobAttemptState): number {
  const attempts = job.opts.attempts;

  return typeof attempts === 'number' && Number.isInteger(attempts) && attempts > 0 ? attempts : 1;
}

/**
 * Call from inside a processor catch block, before BullMQ records the current
 * failed attempt. At that point attemptsMade contains only earlier failures.
 */
export function hasAutomaticAttemptsRemaining(job: JobAttemptState): boolean {
  return job.attemptsMade + 1 < configuredAttempts(job);
}
