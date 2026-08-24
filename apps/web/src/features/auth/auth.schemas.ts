import { z } from 'zod';

const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export const authCredentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address.')
    .max(MAX_EMAIL_LENGTH, 'Enter a valid email address.')
    .email('Enter a valid email address.')
    .transform((email) => email.toLowerCase()),
  password: z
    .string()
    .min(1, 'Enter your password.')
    .min(MIN_PASSWORD_LENGTH, `Password must contain at least ${MIN_PASSWORD_LENGTH} characters.`)
    .refine((password) => utf8ByteLength(password) <= MAX_PASSWORD_BYTES, {
      message: `Password must not exceed ${MAX_PASSWORD_BYTES} UTF-8 bytes.`,
    }),
});

export const currentUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  emailVerified: z.boolean(),
  name: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const authResponseSchema = z.object({
  user: currentUserSchema,
});

export const registrationResponseSchema = z.object({
  data: z.object({
    status: z.literal('VERIFICATION_REQUIRED'),
  }),
});

export const verificationActionResponseSchema = z.object({
  data: z.object({
    status: z.enum(['VERIFIED', 'VERIFICATION_SENT', 'ALREADY_VERIFIED']),
  }),
});

export interface AuthFieldErrors {
  email?: string;
  password?: string;
}

export function validateAuthCredentials(input: {
  email: string;
  password: string;
}):
  | { success: true; data: z.infer<typeof authCredentialsSchema> }
  | { success: false; errors: AuthFieldErrors } {
  const result = authCredentialsSchema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: AuthFieldErrors = {};

  result.error.issues.forEach((issue) => {
    const field = issue.path[0];

    if (field === 'email' && !errors.email) {
      errors.email = issue.message;
    }

    if (field === 'password' && !errors.password) {
      errors.password = issue.message;
    }
  });

  return { success: false, errors };
}
