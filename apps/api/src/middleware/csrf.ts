import type { RequestHandler } from 'express';

import { env } from '../config/env.js';
import { createCsrfService } from '../services/csrf.service.js';
import { AppError } from '../utils/app-error.js';
import { sessionTokenFromRequest } from '../utils/session-cookie.js';

const csrfService = createCsrfService(env.csrfSecret);
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function csrfError(): AppError {
  return new AppError(403, 'CSRF_VALIDATION_FAILED', 'CSRF validation failed');
}

export const requireCsrfToken: RequestHandler = (request, _response, next) => {
  if (!UNSAFE_METHODS.has(request.method.toUpperCase())) {
    next();
    return;
  }

  const sessionToken = sessionTokenFromRequest(request);
  const csrfToken = request.get('X-CSRF-Token');

  if (!sessionToken || !csrfToken || !csrfService.verifyToken(sessionToken, csrfToken)) {
    next(csrfError());
    return;
  }

  next();
};

export function csrfTokenForSession(sessionToken: string): string {
  return csrfService.createToken(sessionToken);
}
