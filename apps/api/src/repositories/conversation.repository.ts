import {
  AiTurnReservationStatus,
  DocumentStatus,
  MessageRole,
  Prisma,
} from '../../../../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';

const publicConversationSelect = {
  id: true,
  title: true,
  createdAt: true,
  updatedAt: true,
} as const;

const publicMessageSelect = {
  id: true,
  role: true,
  content: true,
  citations: true,
  createdAt: true,
} as const;

const conversationListSelect = {
  ...publicConversationSelect,
  messages: {
    where: { role: MessageRole.USER },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { content: true },
  },
} satisfies Prisma.ConversationSelect;

export type ConversationRecord = Prisma.ConversationGetPayload<{
  select: typeof publicConversationSelect;
}>;

export type ConversationListRecord = Prisma.ConversationGetPayload<{
  select: typeof conversationListSelect;
}>;

export type PublicMessageRecord = Prisma.MessageGetPayload<{
  select: typeof publicMessageSelect;
}>;

export interface ConversationDetailRecord extends ConversationRecord {
  messages: PublicMessageRecord[];
}

export interface CompleteConversationTurnInput {
  conversationId: string;
  userId: string;
  content: string;
  citations: Prisma.InputJsonValue;
  aiMetadata?: Prisma.InputJsonValue;
  sourceChunkIds: string[];
  aiTurnReservationId?: string;
}

export interface ConversationPageRecord {
  conversations: ConversationListRecord[];
  total: number;
}

export interface FirstConversationUserMessage {
  id: string;
  content: string;
}

export interface ConversationContextMessageRecord {
  id: string;
  role: typeof MessageRole.USER | typeof MessageRole.ASSISTANT;
  content: string;
  createdAt: Date;
}

export class ActiveConversationNotFoundError extends Error {
  constructor() {
    super('Active conversation does not exist for this user');
    this.name = 'ActiveConversationNotFoundError';
  }
}

export class ConversationSourceConflictError extends Error {
  constructor() {
    super('One or more source chunks are no longer available to this user');
    this.name = 'ConversationSourceConflictError';
  }
}

export async function createConversation(userId: string): Promise<ConversationRecord> {
  return prisma.conversation.create({
    data: {
      userId,
      title: null,
    },
    select: publicConversationSelect,
  });
}

export async function findActiveConversationPageByUserId(
  userId: string,
  page: number,
  limit: number,
): Promise<ConversationPageRecord> {
  const where: Prisma.ConversationWhereInput = {
    userId,
    deletedAt: null,
  };
  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: conversationListSelect,
    }),
    prisma.conversation.count({ where }),
  ]);

  return { conversations, total };
}

export async function findFirstConversationUserMessage(
  conversationId: string,
  userId: string,
): Promise<FirstConversationUserMessage | null> {
  return prisma.message.findFirst({
    where: {
      conversationId,
      role: MessageRole.USER,
      conversation: {
        userId,
        deletedAt: null,
      },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      content: true,
    },
  });
}

export async function setConversationTitleIfEmpty(
  conversationId: string,
  userId: string,
  title: string,
): Promise<boolean> {
  const result = await prisma.conversation.updateMany({
    where: {
      id: conversationId,
      userId,
      deletedAt: null,
      title: null,
    },
    data: { title },
  });

  return result.count === 1;
}

export async function findRecentConversationContextMessages(
  conversationId: string,
  userId: string,
  excludedMessageId: string,
  limit: number,
): Promise<ConversationContextMessageRecord[]> {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error('Conversation context message limit must be a positive integer');
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      id: { not: excludedMessageId },
      role: { in: [MessageRole.USER, MessageRole.ASSISTANT] },
      conversation: {
        userId,
        deletedAt: null,
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
    },
  });

  return messages.reverse().map((message) => ({
    ...message,
    role: message.role === MessageRole.USER ? MessageRole.USER : MessageRole.ASSISTANT,
  }));
}

export async function findActiveConversationByIdForUser(
  conversationId: string,
  userId: string,
): Promise<ConversationRecord | null> {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId,
      deletedAt: null,
    },
    select: publicConversationSelect,
  });
}

export async function findActiveConversationDetailByIdForUser(
  conversationId: string,
  userId: string,
): Promise<ConversationDetailRecord | null> {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId,
      deletedAt: null,
    },
    select: {
      ...publicConversationSelect,
      messages: {
        where: {
          role: { in: [MessageRole.USER, MessageRole.ASSISTANT] },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: publicMessageSelect,
      },
    },
  });
}

export async function createConversationUserMessage(
  conversationId: string,
  userId: string,
  content: string,
): Promise<PublicMessageRecord> {
  return prisma.$transaction(async (transaction) => {
    const conversation = await transaction.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!conversation) {
      throw new ActiveConversationNotFoundError();
    }

    return transaction.message.create({
      data: {
        conversationId,
        role: MessageRole.USER,
        content,
      },
      select: publicMessageSelect,
    });
  });
}

export async function completeConversationTurn(
  input: CompleteConversationTurnInput,
): Promise<PublicMessageRecord> {
  const sourceChunkIds = [...new Set(input.sourceChunkIds)];

  return prisma.$transaction(async (transaction) => {
    const conversation = await transaction.conversation.findFirst({
      where: {
        id: input.conversationId,
        userId: input.userId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!conversation) {
      throw new ActiveConversationNotFoundError();
    }

    if (sourceChunkIds.length > 0) {
      const ownedSourceCount = await transaction.documentChunk.count({
        where: {
          id: { in: sourceChunkIds },
          document: {
            userId: input.userId,
            deletedAt: null,
            status: DocumentStatus.READY,
          },
        },
      });

      if (ownedSourceCount !== sourceChunkIds.length) {
        throw new ConversationSourceConflictError();
      }
    }

    const message = await transaction.message.create({
      data: {
        conversationId: input.conversationId,
        role: MessageRole.ASSISTANT,
        content: input.content,
        citations: input.citations,
        ...(input.aiMetadata === undefined ? {} : { aiMetadata: input.aiMetadata }),
        sourceChunks: {
          connect: sourceChunkIds.map((id) => ({ id })),
        },
      },
      select: publicMessageSelect,
    });

    if (input.aiTurnReservationId) {
      const committed = await transaction.aiTurnReservation.updateMany({
        where: {
          id: input.aiTurnReservationId,
          userId: input.userId,
          status: AiTurnReservationStatus.RESERVED,
        },
        data: {
          status: AiTurnReservationStatus.COMMITTED,
          committedAt: new Date(),
        },
      });

      if (committed.count !== 1) {
        throw new Error('AI turn reservation is no longer available');
      }
    }

    const updatedConversation = await transaction.conversation.updateMany({
      where: {
        id: input.conversationId,
        userId: input.userId,
        deletedAt: null,
      },
      data: {
        updatedAt: new Date(),
      },
    });

    if (updatedConversation.count !== 1) {
      throw new ActiveConversationNotFoundError();
    }

    return message;
  });
}

export async function deleteConversationUserMessage(
  messageId: string,
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const result = await prisma.message.deleteMany({
    where: {
      id: messageId,
      conversationId,
      role: MessageRole.USER,
      conversation: {
        userId,
      },
    },
  });

  return result.count === 1;
}
