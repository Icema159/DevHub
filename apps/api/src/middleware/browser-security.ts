import type { RequestHandler } from 'express';

import type { NodeEnvironment } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

interface SecurityHeadersOptions {
  corsOrigin: string;
  nodeEnvironment: NodeEnvironment;
}

export function createSecurityHeadersMiddleware({
  corsOrigin,
  nodeEnvironment,
}: SecurityHeadersOptions): RequestHandler {
  const productionHttps = nodeEnvironment === 'production' && corsOrigin.startsWith('https://');

  return (_request, response, next) => {
    response.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('X-Frame-Options', 'DENY');

    if (productionHttps) {
      response.setHeader('Strict-Transport-Security', 'max-age=31536000');
    }

    next();
  };
}

export function createOriginValidationMiddleware(allowedOrigin: string): RequestHandler {
  return (request, _response, next) => {
    if (!UNSAFE_METHODS.has(request.method.toUpperCase())) {
      next();
      return;
    }

    if (request.headers.origin !== allowedOrigin) {
      next(new AppError(403, 'INVALID_ORIGIN', 'Request origin is not allowed'));
      return;
    }

    next();
  };
}

export const privateNoStore: RequestHandler = (_request, response, next) => {
  response.setHeader('Cache-Control', 'private, no-store');
  next();
};
