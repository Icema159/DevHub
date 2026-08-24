import { ApiClientError, apiClient } from '../../lib/api-client';
import {
  conversationCreateResponseSchema,
  conversationDetailResponseSchema,
  conversationListResponseSchema,
  conversationMessageCreateResponseSchema,
} from './conversations.schemas';
import type {
  ConversationListResult,
  ConversationTurnResult,
  PublicConversation,
  PublicConversationDetail,
} from './conversations.types';

const CONVERSATION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MAX_CONVERSATION_ID_LENGTH = 128;
export const MAX_CONVERSATION_MESSAGE_LENGTH = 4_000;

export interface ConversationListParams {
  limit?: number;
  page?: number;
}

export interface ConversationReadOptions {
  signal?: AbortSignal;
}

function invalidResponseError(): ApiClientError {
  return new ApiClientError({
    code: 'INVALID_API_RESPONSE',
    kind: 'unexpected',
    message: 'The service returned an unexpected response. Try again.',
  });
}

export function isValidConversationId(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_CONVERSATION_ID_LENGTH &&
    CONVERSATION_ID_PATTERN.test(value)
  );
}

function readConfig(
  options: ConversationReadOptions,
  params?: Record<string, number>,
): { params?: Record<string, number>; signal?: AbortSignal } {
  return {
    ...(params ? { params } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  };
}

export async function listConversations(
  params: ConversationListParams = {},
  options: ConversationReadOptions = {},
): Promise<ConversationListResult> {
  const supportedParams = {
    ...(params.page === undefined ? {} : { page: params.page }),
    ...(params.limit === undefined ? {} : { limit: params.limit }),
  };
  const response = await apiClient.get<unknown>(
    '/api/conversations',
    readConfig(options, supportedParams),
  );
  const parsed = conversationListResponseSchema.safeParse(response.data);

  if (!parsed.success) {
    throw invalidResponseError();
  }

  return {
    conversations: parsed.data.data.conversations,
    meta: parsed.data.meta,
  };
}

export async function createConversation(): Promise<PublicConversation> {
  const response = await apiClient.post<unknown>('/api/conversations');
  const parsed = conversationCreateResponseSchema.safeParse(response.data);

  if (!parsed.success) {
    throw invalidResponseError();
  }

  return parsed.data.data.conversation;
}

export async function getConversation(
  conversationId: string,
  options: ConversationReadOptions = {},
): Promise<PublicConversationDetail> {
  const response = await apiClient.get<unknown>(
    `/api/conversations/${encodeURIComponent(conversationId)}`,
    readConfig(options),
  );
  const parsed = conversationDetailResponseSchema.safeParse(response.data);

  if (!parsed.success) {
    throw invalidResponseError();
  }

  return parsed.data.data.conversation;
}

export function normalizeConversationMessageContent(content: string): string {
  return content.trim();
}

export function conversationMessageValidationError(content: string): string | null {
  const normalizedContent = normalizeConversationMessageContent(content);

  if (normalizedContent.length === 0) {
    return 'Enter a message before sending.';
  }

  if (normalizedContent.length > MAX_CONVERSATION_MESSAGE_LENGTH) {
    return `Message must not exceed ${MAX_CONVERSATION_MESSAGE_LENGTH.toLocaleString('en')} characters.`;
  }

  return null;
}

export async function sendConversationMessage(
  conversationId: string,
  content: string,
): Promise<ConversationTurnResult> {
  const response = await apiClient.post<unknown>(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
    { content },
  );
  const parsed = conversationMessageCreateResponseSchema.safeParse(response.data);

  if (response.status !== 201 || !parsed.success) {
    throw invalidResponseError();
  }

  return parsed.data.data;
}
