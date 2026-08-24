import { AppError } from './app-error.js';

const MAX_MESSAGE_CONTENT_LENGTH = 4_000;
const MAX_CONVERSATION_ID_LENGTH = 128;
const CONVERSATION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const DEFAULT_CONVERSATION_PAGE = 1;
const DEFAULT_CONVERSATION_LIMIT = 20;
const MAX_CONVERSATION_LIMIT = 100;

export interface ConversationListQuery {
  page: number;
  limit: number;
}

function invalidInput(message: string): never {
  throw new AppError(400, 'INVALID_INPUT', message);
}

export function parseConversationId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_CONVERSATION_ID_LENGTH ||
    !CONVERSATION_ID_PATTERN.test(value)
  ) {
    return invalidInput('Conversation ID is invalid');
  }

  return value;
}

export function parseConversationMessageContent(body: unknown): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return invalidInput('Request body must be a JSON object');
  }

  const { content } = body as Record<string, unknown>;

  if (typeof content !== 'string') {
    return invalidInput('Content must be a string');
  }

  const normalizedContent = content.trim();

  if (normalizedContent.length === 0) {
    return invalidInput('Content must not be empty');
  }

  if (normalizedContent.length > MAX_MESSAGE_CONTENT_LENGTH) {
    return invalidInput(`Content must not exceed ${MAX_MESSAGE_CONTENT_LENGTH} characters`);
  }

  return normalizedContent;
}

function parsePositiveInteger(value: unknown, defaultValue: number, fieldName: string): number {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return invalidInput(`${fieldName} must be a positive integer`);
  }

  const parsedValue = Number(value);

  if (!Number.isSafeInteger(parsedValue)) {
    return invalidInput(`${fieldName} must be a positive integer`);
  }

  return parsedValue;
}

export function parseConversationListQuery(value: unknown): ConversationListQuery {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalidInput('Query parameters are invalid');
  }

  const query = value as Record<string, unknown>;
  const page = parsePositiveInteger(query.page, DEFAULT_CONVERSATION_PAGE, 'Page');
  const limit = parsePositiveInteger(query.limit, DEFAULT_CONVERSATION_LIMIT, 'Limit');

  if (limit > MAX_CONVERSATION_LIMIT) {
    return invalidInput(`Limit must not exceed ${MAX_CONVERSATION_LIMIT}`);
  }

  if ((page - 1) * limit > Number.MAX_SAFE_INTEGER) {
    return invalidInput('Page is too large for the selected limit');
  }

  return { page, limit };
}
