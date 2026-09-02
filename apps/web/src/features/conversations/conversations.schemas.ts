import { z } from 'zod';

const conversationIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

const timestampSchema = z.string().datetime();

export const conversationRecordSchema = z.object({
  id: conversationIdSchema,
  title: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const conversationSummarySchema = conversationRecordSchema.extend({
  preview: z.string().nullable(),
});

export const conversationPaginationSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive().max(100),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const conversationSourceSchema = z.object({
  label: z.string().regex(/^S[1-9]\d*$/),
  documentId: z.string().min(1),
  documentName: z.string().min(1),
  chunkId: z.string().min(1),
  chunkPosition: z.number().int().nonnegative(),
  page: z.number().int().positive().nullable(),
});

export const conversationMessageRoleSchema = z.enum(['USER', 'ASSISTANT']);

const conversationMessageBaseSchema = z.object({
  id: z.string().min(1),
  content: z.string(),
  createdAt: timestampSchema,
});

const conversationUserMessageSchema = conversationMessageBaseSchema.extend({
  role: z.literal('USER'),
  sources: z.array(conversationSourceSchema).length(0),
});

const conversationAssistantMessageSchema = conversationMessageBaseSchema.extend({
  role: z.literal('ASSISTANT'),
  sources: z.array(conversationSourceSchema),
});

export const conversationMessageSchema = z.discriminatedUnion('role', [
  conversationUserMessageSchema,
  conversationAssistantMessageSchema,
]);

export const conversationListResponseSchema = z.object({
  data: z.object({
    conversations: z.array(conversationSummarySchema),
  }),
  meta: conversationPaginationSchema,
});

export const conversationCreateResponseSchema = z.object({
  data: z.object({
    conversation: conversationRecordSchema,
  }),
});

export const conversationDetailResponseSchema = z.object({
  data: z.object({
    conversation: conversationRecordSchema.extend({
      messages: z.array(conversationMessageSchema),
    }),
  }),
});

export const conversationMessageCreateResponseSchema = z.object({
  data: z.object({
    message: conversationMessageBaseSchema.extend({
      role: z.literal('ASSISTANT'),
    }),
    sources: z.array(conversationSourceSchema),
  }),
});

export const conversationMessageStreamEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('status'),
    phase: z.enum(['retrieving', 'generating']),
  }),
  z.object({
    type: z.literal('user_message'),
    message: conversationMessageBaseSchema.extend({ role: z.literal('USER') }),
  }),
  z.object({
    type: z.literal('delta'),
    delta: z.string(),
  }),
  z.object({
    type: z.literal('completed'),
    result: conversationMessageCreateResponseSchema.shape.data,
  }),
]);

export const conversationMessageStreamErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  status: z.number().int().min(400).max(599),
});
