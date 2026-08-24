import { describe, expect, it } from 'vitest';

import { resolveApiBaseUrl } from './api-base-url';

describe('API base URL configuration', () => {
  it('uses the local API origin during development', () => {
    expect(resolveApiBaseUrl(undefined, false)).toBe('http://localhost:3000');
    expect(resolveApiBaseUrl('https://api.example.com', false)).toBe('https://api.example.com');
  });

  it('uses only the same-origin Caddy proxy in production', () => {
    expect(resolveApiBaseUrl(undefined, true)).toBe('/');
    expect(resolveApiBaseUrl('/', true)).toBe('/');
    expect(() => resolveApiBaseUrl('http://localhost:3000', true)).toThrow(/proxies \/api/);
  });

  it('rejects malformed development origins', () => {
    expect(() => resolveApiBaseUrl('https://api.example.com/path', false)).toThrow(
      /only an origin/,
    );
  });
});
