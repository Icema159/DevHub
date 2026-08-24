import { SESSION_LIFETIME_MS } from '../config/auth-cookie.js';
import {
  createSession,
  findActiveSessionByTokenHash,
  revokeAllSessionsForUser,
  revokeSession,
  type ActiveSessionRecord,
  type CreateSessionInput,
} from '../repositories/session.repository.js';
import type { AuthenticatedUser } from '../types/authenticated-user.js';
import { generateOpaqueToken, hashOpaqueToken } from '../utils/secure-token.js';

export interface IssuedSession {
  expiresAt: Date;
  token: string;
}

interface SessionServiceDependencies {
  create(input: CreateSessionInput): Promise<void>;
  findActive(tokenHash: string, now: Date): Promise<ActiveSessionRecord | null>;
  generateToken(): string;
  hashToken(token: string): string;
  now(): Date;
  revoke(sessionId: string, userId: string, revokedAt: Date): Promise<boolean>;
  revokeAll(userId: string, revokedAt: Date): Promise<number>;
}

const defaultDependencies: SessionServiceDependencies = {
  create: createSession,
  findActive: findActiveSessionByTokenHash,
  generateToken: generateOpaqueToken,
  hashToken: hashOpaqueToken,
  now: () => new Date(),
  revoke: revokeSession,
  revokeAll: revokeAllSessionsForUser,
};

export function createSessionService(
  dependencies: SessionServiceDependencies = defaultDependencies,
) {
  return {
    async issueSession(userId: string): Promise<IssuedSession> {
      const token = dependencies.generateToken();
      const now = dependencies.now();
      const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);

      await dependencies.create({
        userId,
        tokenHash: dependencies.hashToken(token),
        expiresAt,
      });

      return { token, expiresAt };
    },

    async authenticateSession(token: string): Promise<AuthenticatedUser | null> {
      const session = await dependencies.findActive(
        dependencies.hashToken(token),
        dependencies.now(),
      );

      if (!session) {
        return null;
      }

      return {
        sessionId: session.sessionId,
        userId: session.userId,
        email: session.userEmail,
        emailVerified: session.emailVerified,
      };
    },

    revokeCurrentSession(sessionId: string, userId: string): Promise<boolean> {
      return dependencies.revoke(sessionId, userId, dependencies.now());
    },

    revokeAllUserSessions(userId: string): Promise<number> {
      return dependencies.revokeAll(userId, dependencies.now());
    },
  };
}

export const sessionService = createSessionService();

export async function revokeAllUserSessions(userId: string): Promise<number> {
  return sessionService.revokeAllUserSessions(userId);
}
