import { z } from 'zod';

const apiDocumentStateSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'CHUNKS_READY',
  'EMBEDDING',
  'READY',
  'FAILED',
]);

const statusCountsSchema = z.object({
  all: z.number().int().nonnegative(),
  ready: z.number().int().nonnegative(),
  processing: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

const paginationSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const documentListResponseSchema = z.object({
  data: z.object({
    documents: z.array(
      z.object({
        id: z.string().min(1),
        filename: z.string().min(1),
        mimeType: z.string().min(1),
        size: z.number().int().nonnegative(),
        processingState: apiDocumentStateSchema,
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
        processedAt: z.string().datetime().nullable(),
      }),
    ),
  }),
  meta: paginationSchema.extend({
    statusCounts: statusCountsSchema,
  }),
});

export type ApiDocumentState = z.infer<typeof apiDocumentStateSchema>;
