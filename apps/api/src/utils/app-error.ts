export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly headers: Readonly<Record<string, string>>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    headers: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.headers = headers;
  }
}
