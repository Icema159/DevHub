import { Router } from 'express';

import { searchDocuments } from '../controllers/search.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { privateNoStore } from '../middleware/browser-security.js';
import { requireCsrfToken } from '../middleware/csrf.js';
import { requireVerifiedEmail } from '../middleware/require-verified-email.js';
import { limitAiByIp } from '../middleware/resource-rate-limit.js';

export const searchRouter = Router();

searchRouter.post(
  '/',
  privateNoStore,
  authenticate,
  requireCsrfToken,
  requireVerifiedEmail,
  limitAiByIp,
  searchDocuments,
);
