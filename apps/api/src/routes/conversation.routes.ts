import { Router } from 'express';

import {
  createConversation,
  createConversationMessage,
  getConversation,
  getConversations,
  streamConversationMessage,
} from '../controllers/conversation.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { privateNoStore } from '../middleware/browser-security.js';
import { requireCsrfToken } from '../middleware/csrf.js';
import { requireVerifiedEmail } from '../middleware/require-verified-email.js';
import { limitAiByIp } from '../middleware/resource-rate-limit.js';

export const conversationRouter = Router();

conversationRouter.use(privateNoStore);
conversationRouter.use(authenticate);
conversationRouter.use(requireCsrfToken);
conversationRouter.post('/', createConversation);
conversationRouter.get('/', getConversations);
conversationRouter.get('/:conversationId', getConversation);
conversationRouter.post(
  '/:conversationId/messages',
  requireVerifiedEmail,
  limitAiByIp,
  createConversationMessage,
);
conversationRouter.post(
  '/:conversationId/messages/stream',
  requireVerifiedEmail,
  limitAiByIp,
  streamConversationMessage,
);
