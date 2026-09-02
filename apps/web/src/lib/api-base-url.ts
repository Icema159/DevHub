export function resolveApiBaseUrl(
  configuredValue: string | undefined,
  production: boolean,
): string {
  const configuredUrl = configuredValue?.trim();

  if (production) {
    if (!configuredUrl || configuredUrl === '/') {
      return '/';
    }

    throw new Error(
      'VITE_API_BASE_URL must be / or omitted in production because the Web service proxies /api',
    );
  }

  if (!configuredUrl) {
    // Same-origin dev default: the Vite dev server proxies /api to the local
    // API (see server.proxy in vite.config.ts), mirroring the production
    // topology where a same-origin proxy sits in front of both.
    return '/';
  }

  if (configuredUrl === '/') {
    return '/';
  }

  const parsedUrl = new URL(configuredUrl);

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
