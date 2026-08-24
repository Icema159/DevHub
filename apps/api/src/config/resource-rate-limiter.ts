import { RedisAuthRateLimitStore } from '../infrastructure/redis/redis-auth-rate-limit.store.js';
import { createAuthRateLimitService } from '../services/auth-rate-limit.service.js';
import { env } from './env.js';

let service: ReturnType<typeof createAuthRateLimitService> | undefined;

export function getResourceRateLimitService(): ReturnType<typeof createAuthRateLimitService> {
  service ??= createAuthRateLimitService(
    new RedisAuthRateLimitStore(env.redisUrl),
    'developer-knowledge-hub:resource-rate-limit:v1',
  );

  return service;
}

export async function closeResourceRateLimitService(): Promise<void> {
  await service?.close();
  service = undefined;
}
