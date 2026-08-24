export interface AuthenticatedUser {
  emailVerified: boolean;
  sessionId: string;
  userId: string;
  email: string;
}
