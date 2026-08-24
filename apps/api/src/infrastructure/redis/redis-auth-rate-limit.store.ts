import { createRedisConnectionOptions } from '@developer-knowledge-hub/shared/queue/redis-connection';
import { Redis } from 'ioredis';

import type {
  AuthRateLimitState,
  AuthRateLimitStore,
} from '../../services/auth-rate-limit.service.js';

const CONSUME_FIXED_WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return {count, ttl}
`;

export class RedisAuthRateLimitStore implements AuthRateLimitStore {
  private readonly client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis({
      ...createRedisConnectionOptions(redisUrl, 1),
      connectTimeout: 1_500,
    });

    this.client.on('error', () => {
      // Requests receive a safe 503 from the limiter. Connection details are intentionally omitted.
    });
  }

  async consume(key: string, windowSeconds: number): Promise<AuthRateLimitState> {
    const result = (await this.client.eval(
      CONSUME_FIXED_WINDOW_SCRIPT,
      1,
      key,
      windowSeconds * 1000,
    )) as [number, number];
    const [count, ttlMilliseconds] = result;

    return {
      count,
      retryAfterSeconds: Math.max(1, Math.ceil(ttlMilliseconds / 1000)),
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
