import { describe, expect, it } from 'vitest';

import { createWebSecurityHeaders } from './security-headers';

describe('production web security headers', () => {
  it('allows only the application and configured API while denying framing and objects', () => {
    const headers = createWebSecurityHeaders('/', true);

    expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
    expect(headers['Content-Security-Policy']).toContain("object-src 'none'");
    expect(headers['Content-Security-Policy']).toContain("base-uri 'none'");
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(headers['Content-Security-Policy']).toContain("connect-src 'self'");
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Strict-Transport-Security']).toBe('max-age=31536000');
  });

  it('does not emit HSTS outside production', () => {
    const headers = createWebSecurityHeaders('http://localhost:3000', false);

    expect(headers).not.toHaveProperty('Strict-Transport-Security');
  });
});
