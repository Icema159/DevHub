import type { RequestHandler } from 'express';

import {
  AUTH_COOKIE_NAME,
  authCookieClearOptions,
  authCookieOptions,
} from '../config/auth-cookie.js';
import { getCurrentUser, loginUser, logoutUser, registerUser } from '../services/auth.service.js';
import { csrfTokenForSession } from '../middleware/csrf.js';
import { emailVerificationService } from '../services/email-verification.service.js';
import { AppError } from '../utils/app-error.js';
import { parseAuthCredentials, parseVerificationToken } from '../utils/auth-input.js';
import { requireAuthenticatedUser } from '../utils/request-user.js';
import { sessionTokenFromRequest } from '../utils/session-cookie.js';

export const register: RequestHandler = async (request, response) => {
  const credentials = parseAuthCredentials(request.body);
  const result = await registerUser(credentials);

  response.status(202).json({ data: result });
};

export const login: RequestHandler = async (request, response) => {
  const credentials = parseAuthCredentials(request.body);
  const { user, sessionToken } = await loginUser(credentials);

  response.cookie(AUTH_COOKIE_NAME, sessionToken, authCookieOptions);

  response.status(200).json({ user });
};

export const getMe: RequestHandler = async (request, response) => {
  const authenticatedUser = requireAuthenticatedUser(request);
  const user = await getCurrentUser(authenticatedUser.userId);

  response.status(200).json({ user });
};

export const getCsrfToken: RequestHandler = (request, response) => {
  const sessionToken = sessionTokenFromRequest(request);

  if (!sessionToken) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
  }

  response.status(200).json({ data: { csrfToken: csrfTokenForSession(sessionToken) } });
};

export const logout: RequestHandler = async (request, response) => {
  const authenticatedUser = requireAuthenticatedUser(request);
  await logoutUser(authenticatedUser.sessionId, authenticatedUser.userId);

  response.clearCookie(AUTH_COOKIE_NAME, authCookieClearOptions);
  response.status(204).send();
};

export const verifyEmail: RequestHandler = async (request, response) => {
  const token = parseVerificationToken(request.body);
  await emailVerificationService.verifyEmail(token);

  response.status(200).json({ data: { status: 'VERIFIED' } });
};

export const resendVerification: RequestHandler = async (request, response) => {
  const authenticatedUser = requireAuthenticatedUser(request);
  const result = await emailVerificationService.resendVerification(authenticatedUser.userId);

  response.status(200).json({
    data: {
      status: result.emailVerified ? 'ALREADY_VERIFIED' : 'VERIFICATION_SENT',
    },
  });
};
