import type { RequestHandler } from 'express';

import { AppError } from '../utils/app-error.js';
import { requireAuthenticatedUser } from '../utils/request-user.js';

export const requireVerifiedEmail: RequestHandler = (request, _response, next) => {
  const authenticatedUser = requireAuthenticatedUser(request);

  if (!authenticatedUser.emailVerified) {
    next(
      new AppError(
        403,
        'EMAIL_VERIFICATION_REQUIRED',
        'Verify your email before using this feature',
      ),
    );
    return;
  }

  next();
};
