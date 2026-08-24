import type { RequestHandler } from 'express';

import { conversationService } from '../services/conversation.service.js';
import {
  parseConversationId,
  parseConversationListQuery,
  parseConversationMessageContent,
} from '../utils/conversation-input.js';
import { requireAuthenticatedUser } from '../utils/request-user.js';

export const createConversation: RequestHandler = async (request, response) => {
  const authenticatedUser = requireAuthenticatedUser(request);
  const conversation = await conversationService.create(authenticatedUser.userId);

  response.status(201).json({ data: { conversation } });
};

export const getConversations: RequestHandler = async (request, response) => {
  const authenticatedUser = requireAuthenticatedUser(request);
  const query = parseConversationListQuery(request.query);
  const result = await conversationService.list(authenticatedUser.userId, query);

  response.status(200).json({
    data: { conversations: result.conversations },
    meta: result.meta,
  });
};

export const getConversation: RequestHandler = async (request, response) => {
  const authenticatedUser = requireAuthenticatedUser(request);
  const conversationId = parseConversationId(request.params.conversationId);
  const conversation = await conversationService.get(conversationId, authenticatedUser.userId);

  response.status(200).json({ data: { conversation } });
};

export const createConversationMessage: RequestHandler = async (request, response) => {
  const authenticatedUser = requireAuthenticatedUser(request);
  const conversationId = parseConversationId(request.params.conversationId);
  const content = parseConversationMessageContent(request.body);
  const result = await conversationService.addMessage(
    conversationId,
    authenticatedUser.userId,
    content,
  );

  response.status(201).json({ data: result });
};
