import { ApiClientError, apiClient } from '../../lib/api-client';
import {
  conversationCreateResponseSchema,
  conversationDetailResponseSchema,
  conversationListResponseSchema,
  conversationMessageCreateResponseSchema,
  conversationMessageStreamErrorSchema,
  conversationMessageStreamEventSchema,
} from './conversations.schemas';
import type {
  ConversationListResult,
  ConversationMessageStreamEvent,
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

export interface ConversationMessageStreamOptions {
  onEvent: (event: ConversationMessageStreamEvent) => void;
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

function isReadableByteStream(value: unknown): value is ReadableStream<Uint8Array> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getReader' in value &&
    typeof value.getReader === 'function'
  );
}

function streamErrorKind(status: number): ConstructorParameters<typeof ApiClientError>[0]['kind'] {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 429) return 'rate-limited';
  if (status >= 500) return 'server';
  return status === 400 ? 'validation' : 'unexpected';
}

function parseStreamBlock(
  block: string,
  onEvent: (event: ConversationMessageStreamEvent) => void,
): ConversationTurnResult | null {
  const eventName = block
    .split('\n')
    .find((line) => line.startsWith('event:'))
    ?.slice('event:'.length)
    .trim();
  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart())
    .join('\n');

  if (!eventName || !data) {
    throw invalidResponseError();
  }

  let decoded: unknown;

  try {
    decoded = JSON.parse(data);
  } catch {
    throw invalidResponseError();
  }

  if (eventName === 'error') {
    const parsedError = conversationMessageStreamErrorSchema.safeParse(decoded);

    if (!parsedError.success) {
      throw invalidResponseError();
    }

    throw new ApiClientError({
      code: parsedError.data.code,
      kind: streamErrorKind(parsedError.data.status),
      message: parsedError.data.message,
      status: parsedError.data.status,
    });
  }

  const parsedEvent = conversationMessageStreamEventSchema.safeParse(decoded);

  if (!parsedEvent.success || parsedEvent.data.type !== eventName) {
    throw invalidResponseError();
  }

  onEvent(parsedEvent.data);
  return parsedEvent.data.type === 'completed' ? parsedEvent.data.result : null;
}

export async function streamConversationMessage(
  conversationId: string,
  content: string,
  options: ConversationMessageStreamOptions,
): Promise<ConversationTurnResult> {
  const response = await apiClient.post<ReadableStream<Uint8Array>>(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages/stream`,
    { content },
    {
      adapter: 'fetch',
      responseType: 'stream',
      timeout: 0,
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );

  if (response.status !== 200 || !isReadableByteStream(response.data)) {
    throw invalidResponseError();
  }

  const reader = response.data.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: ConversationTurnResult | null = null;

  while (true) {
    const read = await reader.read();
    buffer += decoder.decode(read.value, { stream: !read.done }).replace(/\r\n/g, '\n');

    let boundary = buffer.indexOf('\n\n');

    while (boundary >= 0) {
      const block = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 2);

      if (block) {
        result = parseStreamBlock(block, options.onEvent) ?? result;
      }

      boundary = buffer.indexOf('\n\n');
    }

    if (read.done) break;
  }

  if (buffer.trim()) {
    result = parseStreamBlock(buffer.trim(), options.onEvent) ?? result;
  }

  if (!result) {
    throw invalidResponseError();
  }

  return result;
}
