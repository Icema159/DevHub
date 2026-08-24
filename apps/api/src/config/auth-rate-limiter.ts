import { RedisAuthRateLimitStore } from '../infrastructure/redis/redis-auth-rate-limit.store.js';
import { createAuthRateLimitService } from '../services/auth-rate-limit.service.js';
import { env } from './env.js';

let authRateLimitService: ReturnType<typeof createAuthRateLimitService> | undefined;

export function getAuthRateLimitService(): ReturnType<typeof createAuthRateLimitService> {
  authRateLimitService ??= createAuthRateLimitService(new RedisAuthRateLimitStore(env.redisUrl));
  return authRateLimitService;
}

export async function closeAuthRateLimitService(): Promise<void> {
  await authRateLimitService?.close();
  authRateLimitService = undefined;
}
