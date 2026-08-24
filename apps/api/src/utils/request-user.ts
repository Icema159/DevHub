import type { Request } from 'express';

import type { AuthenticatedUser } from '../types/authenticated-user.js';
import { AppError } from './app-error.js';

export function requireAuthenticatedUser(request: Request): AuthenticatedUser {
  if (!request.user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
  }

  return request.user;
}
