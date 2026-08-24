import type { RequestHandler } from 'express';

import { sessionService } from '../services/session.service.js';
import { AppError } from '../utils/app-error.js';
import { sessionTokenFromRequest } from '../utils/session-cookie.js';

function authenticationError(): AppError {
  return new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
}

export const authenticate: RequestHandler = async (request, _response, next) => {
  const token = sessionTokenFromRequest(request);

  if (!token) {
    next(authenticationError());
    return;
  }

  try {
    const authenticatedUser = await sessionService.authenticateSession(token);

    if (!authenticatedUser) {
      next(authenticationError());
      return;
    }

    request.user = authenticatedUser;
    next();
  } catch {
    next(authenticationError());
  }
};
