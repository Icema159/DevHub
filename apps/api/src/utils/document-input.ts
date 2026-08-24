import { AppError } from './app-error.js';

const MAX_DOCUMENT_ID_LENGTH = 128;
const DOCUMENT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MAX_DOCUMENT_SEARCH_LENGTH = 255;
const DEFAULT_DOCUMENT_PAGE = 1;
const DEFAULT_DOCUMENT_LIMIT = 10;
const MAX_DOCUMENT_LIMIT = 100;

export type PublicDocumentStatus = 'ALL' | 'READY' | 'PROCESSING' | 'FAILED';

export interface DocumentListQuery {
  page: number;
  limit: number;
  search: string | undefined;
  status: PublicDocumentStatus;
}

function invalidInput(message: string): never {
  throw new AppError(400, 'INVALID_INPUT', message);
}

export function parseDocumentId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_DOCUMENT_ID_LENGTH ||
    !DOCUMENT_ID_PATTERN.test(value)
  ) {
    return invalidInput('Document ID is invalid');
  }

  return value;
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

function parseSearch(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return invalidInput('Search must be a string');
  }

  const search = value.trim();

  if (search.length === 0) {
    return undefined;
  }

  if (search.length > MAX_DOCUMENT_SEARCH_LENGTH) {
    return invalidInput(`Search must not exceed ${MAX_DOCUMENT_SEARCH_LENGTH} characters`);
  }

  return search;
}

function parseStatus(value: unknown): PublicDocumentStatus {
  if (value === undefined) {
    return 'ALL';
  }

  if (value === 'ALL' || value === 'READY' || value === 'PROCESSING' || value === 'FAILED') {
    return value;
  }

  return invalidInput('Status must be one of ALL, READY, PROCESSING, or FAILED');
}

export function parseDocumentListQuery(value: unknown): DocumentListQuery {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalidInput('Query parameters are invalid');
  }

  const query = value as Record<string, unknown>;
  const page = parsePositiveInteger(query.page, DEFAULT_DOCUMENT_PAGE, 'Page');
  const limit = parsePositiveInteger(query.limit, DEFAULT_DOCUMENT_LIMIT, 'Limit');

  if (limit > MAX_DOCUMENT_LIMIT) {
    return invalidInput(`Limit must not exceed ${MAX_DOCUMENT_LIMIT}`);
  }

  if ((page - 1) * limit > Number.MAX_SAFE_INTEGER) {
    return invalidInput('Page is too large for the selected limit');
  }

  return {
    page,
    limit,
    search: parseSearch(query.search),
    status: parseStatus(query.status),
  };
}
