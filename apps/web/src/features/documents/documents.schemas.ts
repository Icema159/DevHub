import { z } from 'zod';

export const documentApiStateSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'CHUNKS_READY',
  'EMBEDDING',
  'READY',
  'FAILED',
]);

const dateTimeSchema = z.string().datetime();

const publicDocumentSchema = z.object({
  id: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().nonnegative(),
  processingState: documentApiStateSchema,
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
  processedAt: dateTimeSchema.nullable(),
});

const listDocumentSchema = publicDocumentSchema;

const statusCountsSchema = z.object({
  all: z.number().int().nonnegative(),
  ready: z.number().int().nonnegative(),
  processing: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

export const documentListResponseSchema = z.object({
  data: z.object({
    documents: z.array(listDocumentSchema),
  }),
  meta: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    statusCounts: statusCountsSchema,
  }),
});

export const documentUploadResponseSchema = z.object({
  document: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    mimeType: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
    status: documentApiStateSchema,
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
    processedAt: dateTimeSchema.nullable(),
  }),
});

export const documentDetailsResponseSchema = z.object({
  data: z.object({
    document: publicDocumentSchema.extend({
      processingError: z.string().nullable(),
    }),
  }),
});

export const documentRetryResponseSchema = documentDetailsResponseSchema;

export const documentDeletionResponseSchema = z.object({
  data: z.object({
    document: z.object({
      id: z.string().min(1),
      deletedAt: dateTimeSchema,
    }),
  }),
});
