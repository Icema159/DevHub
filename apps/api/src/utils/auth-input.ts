import { AppError } from './app-error.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;
const VERIFICATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface AuthCredentials {
  email: string;
  password: string;
}

function invalidInput(message: string): never {
  throw new AppError(400, 'INVALID_INPUT', message);
}

export function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

export function getNormalizedEmailIdentity(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  const email = (body as Record<string, unknown>).email;

  if (typeof email !== 'string') {
    return null;
  }

  const normalizedEmail = normalizeEmailAddress(email);

  return normalizedEmail.length > 0 && normalizedEmail.length <= MAX_EMAIL_LENGTH
    ? normalizedEmail
    : null;
}

export function parseAuthCredentials(body: unknown): AuthCredentials {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return invalidInput('Request body must be a JSON object');
  }

  const { email, password } = body as Record<string, unknown>;

  if (typeof email !== 'string') {
    return invalidInput('Email must be a string');
  }

  const normalizedEmail = normalizeEmailAddress(email);

  if (
    normalizedEmail.length === 0 ||
    normalizedEmail.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(normalizedEmail)
  ) {
    return invalidInput('Email must be a valid email address');
  }

  if (typeof password !== 'string') {
    return invalidInput('Password must be a string');
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return invalidInput(`Password must contain at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return invalidInput(`Password must not exceed ${MAX_PASSWORD_BYTES} UTF-8 bytes`);
  }

  return {
    email: normalizedEmail,
    password,
  };
}

export function parseVerificationToken(body: unknown): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return invalidInput('Request body must be a JSON object');
  }

  const token = (body as Record<string, unknown>).token;

  if (typeof token !== 'string' || !VERIFICATION_TOKEN_PATTERN.test(token)) {
    return invalidInput('Verification token is invalid');
  }

  return token;
}
