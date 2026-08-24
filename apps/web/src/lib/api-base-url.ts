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
    return 'http://localhost:3000';
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
