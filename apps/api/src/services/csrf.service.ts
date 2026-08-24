import { createHmac, timingSafeEqual } from 'node:crypto';

interface CsrfService {
  createToken(sessionToken: string): string;
  verifyToken(sessionToken: string, csrfToken: string): boolean;
}

export function createCsrfService(secret: string): CsrfService {
  function createToken(sessionToken: string): string {
    return createHmac('sha256', secret).update(sessionToken, 'utf8').digest('base64url');
  }

  return {
    createToken,
    verifyToken(sessionToken, csrfToken) {
      const expectedToken = createToken(sessionToken);
      const expectedBuffer = Buffer.from(expectedToken, 'utf8');
      const suppliedBuffer = Buffer.from(csrfToken, 'utf8');

      return (
        expectedBuffer.length === suppliedBuffer.length &&
        timingSafeEqual(expectedBuffer, suppliedBuffer)
      );
    },
  };
}
