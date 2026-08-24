import type { AuthRateLimitPolicy } from './auth-rate-limit.js';
import { RESOURCE_LIMITS } from './resource-limits.js';

export const RESOURCE_RATE_LIMIT_POLICIES = Object.freeze({
  uploadIp: {
    name: 'upload-ip',
    limit: RESOURCE_LIMITS.perIpUploadAttemptsPerHour,
    windowSeconds: 60 * 60,
  },
  aiIp: {
    name: 'ai-ip',
    limit: RESOURCE_LIMITS.perIpAiAttemptsPerHour,
    windowSeconds: 60 * 60,
  },
} as const satisfies Record<string, AuthRateLimitPolicy>);
