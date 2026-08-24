import { createHash } from 'node:crypto';

import type { AuthRateLimitPolicy } from '../config/auth-rate-limit.js';

export interface AuthRateLimitState {
  count: number;
  retryAfterSeconds: number;
}

export interface AuthRateLimitStore {
  close?(): Promise<void>;
  consume(key: string, windowSeconds: number): Promise<AuthRateLimitState>;
  delete?(key: string): Promise<void>;
}

export interface AuthRateLimitDecision extends AuthRateLimitState {
  allowed: boolean;
  key: string;
}

export function hashRateLimitSubject(subject: string): string {
  return createHash('sha256').update(subject, 'utf8').digest('hex');
}

export function createAuthRateLimitService(
  store: AuthRateLimitStore,
  keyPrefix = 'developer-knowledge-hub:auth-rate-limit:v1',
) {
  function keyFor(policy: AuthRateLimitPolicy, subject: string): string {
    return `${keyPrefix}:${policy.name}:${hashRateLimitSubject(subject)}`;
  }

  return {
    async consume(policy: AuthRateLimitPolicy, subject: string): Promise<AuthRateLimitDecision> {
      const key = keyFor(policy, subject);
      const state = await store.consume(key, policy.windowSeconds);

      return {
        ...state,
        key,
        allowed: state.count <= policy.limit,
      };
    },

    async reset(policy: AuthRateLimitPolicy, subject: string): Promise<void> {
      await store.delete?.(keyFor(policy, subject));
    },

    close(): Promise<void> {
      return store.close?.() ?? Promise.resolve();
    },
  };
}
