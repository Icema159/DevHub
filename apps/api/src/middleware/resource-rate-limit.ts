import type { Request, RequestHandler } from 'express';

import { RESOURCE_RATE_LIMIT_POLICIES } from '../config/resource-rate-limit.js';
import { getResourceRateLimitService } from '../config/resource-rate-limiter.js';
import { AppError } from '../utils/app-error.js';

function requestIp(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? 'unknown';
}

interface ResourceRateLimiter {
  consume(
    policy: (typeof RESOURCE_RATE_LIMIT_POLICIES)[keyof typeof RESOURCE_RATE_LIMIT_POLICIES],
    subject: string,
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
}

export function createResourceRateLimitMiddleware(rateLimiter: ResourceRateLimiter) {
  function createLimiter(
    policy: (typeof RESOURCE_RATE_LIMIT_POLICIES)[keyof typeof RESOURCE_RATE_LIMIT_POLICIES],
  ): RequestHandler {
    return (request, _response, next) => {
      void rateLimiter
        .consume(policy, requestIp(request))
        .then((decision) => {
          if (!decision.allowed) {
            next(
              new AppError(429, 'RESOURCE_RATE_LIMITED', 'Too many requests. Try again later', {
                'Retry-After': String(decision.retryAfterSeconds),
              }),
            );
            return;
          }

          next();
        })
        .catch(() => {
          next(
            new AppError(
              503,
              'RESOURCE_PROTECTION_UNAVAILABLE',
              'Resource protection is temporarily unavailable',
            ),
          );
        });
    };
  }

  return {
    limitUploadByIp: createLimiter(RESOURCE_RATE_LIMIT_POLICIES.uploadIp),
    limitAiByIp: createLimiter(RESOURCE_RATE_LIMIT_POLICIES.aiIp),
  };
}

export const { limitUploadByIp, limitAiByIp } = createResourceRateLimitMiddleware({
  consume: (policy, subject) => getResourceRateLimitService().consume(policy, subject),
});
