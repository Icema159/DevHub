import { parseCookie } from 'cookie';
import type { Request } from 'express';

import { AUTH_COOKIE_NAME } from '../config/auth-cookie.js';

export function sessionTokenFromRequest(request: Request): string | null {
  const cookies = parseCookie(request.headers.cookie ?? '');

  return cookies[AUTH_COOKIE_NAME] ?? null;
}
