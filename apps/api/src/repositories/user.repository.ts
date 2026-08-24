import { Prisma } from '../../../../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';

export interface SafeUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  emailVerified: boolean;
}

export interface UserWithPassword extends SafeUser {
  passwordHash: string;
}

export class DuplicateUserEmailError extends Error {
  constructor() {
    super('User email already exists');
    this.name = 'DuplicateUserEmailError';
  }
}

function isUserEmailUniqueViolation(error: Prisma.PrismaClientKnownRequestError): boolean {
  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.includes('email');
  }

  // Prisma's PostgreSQL driver adapter can omit `target` while still reporting
  // the model that raised P2002. This transaction creates User with an
  // application-generated email as its only caller-controlled unique field.
  return error.meta?.modelName === 'User';
}

const safeUserSelect = {
  id: true,
  email: true,
  name: true,
  emailVerifiedAt: true,
  createdAt: true,
} as const;

function toSafeUser(user: {
  id: string;
  email: string;
  name: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerifiedAt !== null,
    createdAt: user.createdAt,
  };
}

export async function findUserByEmail(email: string): Promise<UserWithPassword | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      ...safeUserSelect,
      passwordHash: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    ...toSafeUser(user),
    passwordHash: user.passwordHash,
  };
}

export async function findUserById(id: string): Promise<SafeUser | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: safeUserSelect,
  });

  return user ? toSafeUser(user) : null;
}

export async function createUserWithVerificationToken(input: {
  email: string;
  passwordHash: string;
  verificationToken: {
    expiresAt: Date;
    tokenHash: string;
  };
}): Promise<SafeUser> {
  try {
    const user = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
        },
        select: safeUserSelect,
      });

      await transaction.emailVerificationToken.create({
        data: {
          userId: createdUser.id,
          tokenHash: input.verificationToken.tokenHash,
          expiresAt: input.verificationToken.expiresAt,
        },
        select: { id: true },
      });

      return createdUser;
    });

    return toSafeUser(user);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      isUserEmailUniqueViolation(error)
    ) {
      throw new DuplicateUserEmailError();
    }

    throw error;
  }
}
