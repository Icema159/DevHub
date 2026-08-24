import { AppError } from './app-error.js';

const MAX_SEARCH_QUERY_LENGTH = 4_000;

export interface SearchInput {
  query: string;
}

function invalidInput(message: string): never {
  throw new AppError(400, 'INVALID_INPUT', message);
}

export function parseSearchInput(body: unknown): SearchInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return invalidInput('Request body must be a JSON object');
  }

  const { query } = body as Record<string, unknown>;

  if (typeof query !== 'string') {
    return invalidInput('Query must be a string');
  }

  const normalizedQuery = query.trim();

  if (normalizedQuery.length === 0) {
    return invalidInput('Query must not be empty');
  }

  if (normalizedQuery.length > MAX_SEARCH_QUERY_LENGTH) {
    return invalidInput(`Query must not exceed ${MAX_SEARCH_QUERY_LENGTH} characters`);
  }

  return { query: normalizedQuery };
}
