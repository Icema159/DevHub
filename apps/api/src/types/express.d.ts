import type { AuthenticatedUser } from './authenticated-user.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}
