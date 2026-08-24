import { URL } from 'node:url';

export interface RedisConnectionOptions {
  host: string;
  port: number;
  family: number;
  db: number;
  maxRetriesPerRequest: number | null;
  username?: string;
  password?: string;
  tls?: Record<string, never>;
}

function parseDatabase(pathname: string): number {
  if (pathname === '' || pathname === '/') {
    return 0;
  }

  const value = pathname.slice(1);

  if (!/^\d+$/.test(value)) {
    throw new Error('REDIS_URL database path must be a non-negative integer');
  }

  return Number(value);
}

export function createRedisConnectionOptions(
  redisUrl: string,
  maxRetriesPerRequest: number | null,
): RedisConnectionOptions {
  const parsedUrl = new URL(redisUrl);

  if (parsedUrl.protocol !== 'redis:' && parsedUrl.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must use the redis or rediss protocol');
  }

  return {
    host: parsedUrl.hostname,
    port: parsedUrl.port ? Number(parsedUrl.port) : 6379,
    family: 0,
    db: parseDatabase(parsedUrl.pathname),
    maxRetriesPerRequest,
    ...(parsedUrl.username ? { username: decodeURIComponent(parsedUrl.username) } : {}),
    ...(parsedUrl.password ? { password: decodeURIComponent(parsedUrl.password) } : {}),
    ...(parsedUrl.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}
