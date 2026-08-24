import { Router } from 'express';

import {
  getMe,
  getCsrfToken,
  login,
  logout,
  register,
  resendVerification,
  verifyEmail,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { privateNoStore } from '../middleware/browser-security.js';
import { requireCsrfToken } from '../middleware/csrf.js';
import {
  limitLogin,
  limitRegistration,
  limitVerificationResend,
  limitVerificationSubmission,
} from '../middleware/auth-rate-limit.js';

export const authRouter = Router();

authRouter.use(privateNoStore);
authRouter.post('/register', limitRegistration, register);
authRouter.post('/login', limitLogin, login);
authRouter.post('/verify-email', limitVerificationSubmission, verifyEmail);
authRouter.post(
  '/resend-verification',
  authenticate,
  requireCsrfToken,
  limitVerificationResend,
  resendVerification,
);
authRouter.get('/me', authenticate, getMe);
authRouter.get('/csrf-token', authenticate, getCsrfToken);
authRouter.post('/logout', authenticate, requireCsrfToken, logout);
