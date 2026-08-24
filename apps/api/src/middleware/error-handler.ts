import type { ErrorRequestHandler } from 'express';

import { AppError } from '../utils/app-error.js';

interface JsonSyntaxError {
  status: number;
  type: string;
}

function isJsonSyntaxError(error: unknown): error is JsonSyntaxError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === 400 &&
    'type' in error &&
    error.type === 'entity.parse.failed'
  );
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next;

  if (isJsonSyntaxError(error)) {
    response.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Request body contains invalid JSON',
      },
    });
    return;
  }

  if (error instanceof AppError) {
    for (const [name, value] of Object.entries(error.headers)) {
      response.setHeader(name, value);
    }

    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  console.error('Unhandled API error', error);

  response.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  });
};
