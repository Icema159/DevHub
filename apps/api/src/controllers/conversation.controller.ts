import type { RequestHandler } from 'express';

import { conversationService } from '../services/conversation.service.js';
import { AppError } from '../utils/app-error.js';
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

function writeStreamEvent(
  response: Parameters<RequestHandler>[1],
  event: string,
  data: unknown,
): void {
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Extracts a small, deliberately curated set of fields for logging an
 * unexpected streaming failure. Unlike `console.error(label, error)`, this
 * never serializes the raw error object: a provider SDK error (or a wrapped
 * HTTP client error) can carry enumerable properties such as request
 * config/headers that must not reach application logs. Name and message are
 * sufficient to diagnose the failure class without that risk.
 */
function safeStreamErrorMetadata(error: unknown): Readonly<Record<string, unknown>> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  return { name: 'UnknownError', message: 'A non-Error value was thrown' };
}

export const streamConversationMessage: RequestHandler = async (request, response) => {
  const authenticatedUser = requireAuthenticatedUser(request);
  const conversationId = parseConversationId(request.params.conversationId);
  const content = parseConversationMessageContent(request.body);
  const abortController = new AbortController();
  const stream = conversationService.streamMessage(
    conversationId,
    authenticatedUser.userId,
    content,
    { signal: abortController.signal },
  );

  response.once('close', () => {
    abortController.abort();
  });

  try {
    const firstEvent = await stream.next();

    if (firstEvent.done) {
      throw new AppError(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred');
    }

    if (response.destroyed) {
      await stream.return(undefined);
      return;
    }

    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();
    writeStreamEvent(response, firstEvent.value.type, firstEvent.value);

    for await (const event of stream) {
      if (response.destroyed) {
        break;
      }

      writeStreamEvent(response, event.type, event);
    }
  } catch (error) {
    if (!response.headersSent) {
      throw error;
    }

    if (!response.destroyed && !abortController.signal.aborted) {
      const publicError =
        error instanceof AppError
          ? { code: error.code, message: error.message, status: error.statusCode }
          : {
              code: 'INTERNAL_SERVER_ERROR',
              message: 'An unexpected error occurred',
              status: 500,
            };

      if (!(error instanceof AppError)) {
        console.error('Unhandled conversation stream error', safeStreamErrorMetadata(error));
      }

      writeStreamEvent(response, 'error', publicError);
    }
  } finally {
    if (response.headersSent && !response.destroyed) {
      response.end();
    }
  }
};
