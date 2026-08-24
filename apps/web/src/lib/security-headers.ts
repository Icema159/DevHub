const BASE_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
];

function apiOrigin(apiBaseUrl: string): string | null {
  if (apiBaseUrl === '/') {
    return null;
  }

  const parsedUrl = new URL(apiBaseUrl);

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('VITE_API_BASE_URL must use the http or https protocol');
  }

  if (
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.pathname !== '/' ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error('VITE_API_BASE_URL must contain only an origin without credentials or a path');
  }

  return parsedUrl.origin;
}

export function createWebSecurityHeaders(
  apiBaseUrl: string,
  production: boolean,
): Record<string, string> {
  const allowedApiOrigin = apiOrigin(apiBaseUrl);
  const headers: Record<string, string> = {
    'Content-Security-Policy': [
      ...BASE_CONTENT_SECURITY_POLICY,
      `connect-src 'self'${allowedApiOrigin ? ` ${allowedApiOrigin}` : ''}`,
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'X-Frame-Options': 'DENY',
  };

  if (production) {
    headers['Strict-Transport-Security'] = 'max-age=31536000';
  }

  return headers;
}
