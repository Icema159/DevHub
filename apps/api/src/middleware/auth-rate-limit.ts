import type { NextFunction, Request, RequestHandler } from 'express';

import { AUTH_RATE_LIMIT_POLICIES, type AuthRateLimitPolicy } from '../config/auth-rate-limit.js';
import { getAuthRateLimitService } from '../config/auth-rate-limiter.js';
import { AppError } from '../utils/app-error.js';
import { getNormalizedEmailIdentity } from '../utils/auth-input.js';
import { requireAuthenticatedUser } from '../utils/request-user.js';

interface RateLimitCheck {
  policy: AuthRateLimitPolicy;
  subject: string;
}

interface AuthRateLimiter {
  consume(
    policy: AuthRateLimitPolicy,
    subject: string,
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
}

function rateLimitExceeded(retryAfterSeconds: number): AppError {
  return new AppError(429, 'RATE_LIMITED', 'Too many requests. Try again later', {
    'Retry-After': String(retryAfterSeconds),
  });
}

function authProtectionUnavailable(): AppError {
  return new AppError(
    503,
    'AUTH_PROTECTION_UNAVAILABLE',
    'Authentication service is temporarily unavailable',
  );
}

function requestIp(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? 'unknown';
}

export function createAuthRateLimitMiddleware(rateLimiter: AuthRateLimiter) {
  async function enforceChecks(checks: RateLimitCheck[], next: NextFunction): Promise<void> {
    try {
      let longestRetryAfter = 0;

      for (const check of checks) {
        const decision = await rateLimiter.consume(check.policy, check.subject);

        if (!decision.allowed) {
          longestRetryAfter = Math.max(longestRetryAfter, decision.retryAfterSeconds);
        }
      }

      if (longestRetryAfter > 0) {
        next(rateLimitExceeded(longestRetryAfter));
        return;
      }

      next();
    } catch {
      next(authProtectionUnavailable());
    }
  }

  const limitRegistration: RequestHandler = (request, _response, next) => {
    void enforceChecks(
      [{ policy: AUTH_RATE_LIMIT_POLICIES.registrationIp, subject: requestIp(request) }],
      next,
    );
  };

  const limitLogin: RequestHandler = (request, _response, next) => {
    const normalizedEmail = getNormalizedEmailIdentity(request.body);
    const checks: RateLimitCheck[] = [
      { policy: AUTH_RATE_LIMIT_POLICIES.loginIp, subject: requestIp(request) },
    ];

    if (normalizedEmail) {
      checks.push({ policy: AUTH_RATE_LIMIT_POLICIES.loginIdentity, subject: normalizedEmail });
    }

    void enforceChecks(checks, next);
  };

  const limitVerificationResend: RequestHandler = (request, _response, next) => {
    const authenticatedUser = requireAuthenticatedUser(request);

    void enforceChecks(
      [
        { policy: AUTH_RATE_LIMIT_POLICIES.resendUser, subject: authenticatedUser.userId },
        { policy: AUTH_RATE_LIMIT_POLICIES.resendIp, subject: requestIp(request) },
      ],
      next,
    );
  };

  const limitVerificationSubmission: RequestHandler = (request, _response, next) => {
    void enforceChecks(
      [{ policy: AUTH_RATE_LIMIT_POLICIES.verificationIp, subject: requestIp(request) }],
      next,
    );
  };

  return {
    limitLogin,
    limitRegistration,
    limitVerificationResend,
    limitVerificationSubmission,
  };
}

const configuredMiddleware = createAuthRateLimitMiddleware({
  consume: (policy, subject) => getAuthRateLimitService().consume(policy, subject),
});

export const {
  limitLogin,
  limitRegistration,
  limitVerificationResend,
  limitVerificationSubmission,
} = configuredMiddleware;
