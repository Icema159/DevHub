import type { CookieOptions } from 'express';

import { env } from './env.js';

export const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthCookieConfiguration {
  clearOptions: CookieOptions;
  name: string;
  options: CookieOptions;
}

export function createAuthCookieConfiguration(nodeEnvironment: string): AuthCookieConfiguration {
  const isProduction = nodeEnvironment === 'production';
  const sharedCookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
  } as const satisfies CookieOptions;

  return {
    name: isProduction
      ? '__Host-developer-knowledge-hub-session'
      : 'developer_knowledge_hub_session',
    options: {
      ...sharedCookieOptions,
      maxAge: SESSION_LIFETIME_MS,
    },
    clearOptions: {
      ...sharedCookieOptions,
    },
  };
}

const authCookieConfiguration = createAuthCookieConfiguration(env.nodeEnv);

export const AUTH_COOKIE_NAME = authCookieConfiguration.name;

export const authCookieOptions: CookieOptions = Object.freeze(authCookieConfiguration.options);

export const authCookieClearOptions: CookieOptions = Object.freeze(
  authCookieConfiguration.clearOptions,
);
