import {
  createUserWithVerificationToken,
  DuplicateUserEmailError,
  findUserByEmail,
  findUserById,
  type SafeUser,
} from '../repositories/user.repository.js';
import type { AuthCredentials } from '../utils/auth-input.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { AppError } from '../utils/app-error.js';
import { logEmailDeliveryFailure } from './email-delivery-error.js';
import { emailVerificationService } from './email-verification.service.js';
import { sessionService } from './session.service.js';

const INVALID_LOGIN_PASSWORD_HASH = '$2b$12$Z2oVLOq230ytRmnoMbnkPOLnZsGczJN5kO1czG6REM2xZkVcL/bqS';

export interface RegistrationResult {
  status: 'VERIFICATION_REQUIRED';
}

export async function registerUser(credentials: AuthCredentials): Promise<RegistrationResult> {
  const passwordHash = await hashPassword(credentials.password);
  const preparedToken = emailVerificationService.prepareVerificationToken();
  let createdUser: SafeUser;

  try {
    createdUser = await createUserWithVerificationToken({
      email: credentials.email,
      passwordHash,
      verificationToken: preparedToken.record,
    });
  } catch (error) {
    if (error instanceof DuplicateUserEmailError) {
      return { status: 'VERIFICATION_REQUIRED' };
    }

    throw error;
  }

  try {
    await emailVerificationService.deliverVerificationEmail(
      createdUser.email,
      preparedToken.rawToken,
    );
  } catch (error) {
    logEmailDeliveryFailure('Initial verification email delivery failed', error);
  }

  return { status: 'VERIFICATION_REQUIRED' };
}

export interface LoginResult {
  user: SafeUser;
  sessionToken: string;
}

export async function loginUser(credentials: AuthCredentials): Promise<LoginResult> {
  const user = await findUserByEmail(credentials.email);
  const passwordMatches = await verifyPassword(
    credentials.password,
    user?.passwordHash ?? INVALID_LOGIN_PASSWORD_HASH,
  );

  if (!user || !passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const safeUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };
  const session = await sessionService.issueSession(safeUser.id);

  return {
    user: safeUser,
    sessionToken: session.token,
  };
}

export async function getCurrentUser(userId: string): Promise<SafeUser> {
  const user = await findUserById(userId);

  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
  }

  return user;
}

export async function logoutUser(sessionId: string, userId: string): Promise<void> {
  const revoked = await sessionService.revokeCurrentSession(sessionId, userId);

  if (!revoked) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
  }
}
