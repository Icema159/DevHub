import type { GeneratedChatAnswer } from '@developer-knowledge-hub/ai/chat-generation';
import { AiOperation } from '../../../../generated/prisma/client.js';

import {
  releaseAiTurn,
  reserveAiTurn,
  type AiTurnReservationDecision,
} from '../repositories/ai-turn-quota.repository.js';
import {
  ActiveConversationNotFoundError,
  completeConversationTurn,
  type CompleteConversationTurnInput,
  type ConversationContextMessageRecord,
  type ConversationDetailRecord,
  type ConversationListRecord,
  type ConversationPageRecord,
  type ConversationRecord,
  createConversation,
  createConversationUserMessage,
  deleteConversationUserMessage,
  findActiveConversationPageByUserId,
  findActiveConversationByIdForUser,
  findActiveConversationDetailByIdForUser,
  findFirstConversationUserMessage,
  findRecentConversationContextMessages,
  type FirstConversationUserMessage,
  type PublicMessageRecord,
  setConversationTitleIfEmpty,
} from '../repositories/conversation.repository.js';
import type { RetrievedChunk } from '../repositories/vector.repository.js';
import { AppError } from '../utils/app-error.js';
import type { ConversationListQuery } from '../utils/conversation-input.js';
import {
  buildBoundedConversationContext,
  buildContextAwareRetrievalQuery,
  buildGroundedPrompt,
  type CitationSource,
  INSUFFICIENT_CONTEXT_ANSWER,
  MAX_CONVERSATION_CONTEXT_MESSAGES,
  selectCitedSources,
} from './rag-prompt.service.js';
import { retrievalService } from './retrieval.service.js';
import { AiBudgetUnavailableError, aiBudgetService } from './ai-budget.service.js';

export interface PublicMessage {
  id: string;
  role: PublicMessageRecord['role'];
  content: string;
  createdAt: Date;
}

export interface PublicConversationDetail extends ConversationRecord {
  messages: Array<PublicMessage & { sources: CitationSource[] }>;
}

export interface PublicConversationSummary extends ConversationRecord {
  preview: string | null;
}

export interface PublicConversationListResult {
  conversations: PublicConversationSummary[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ConversationTurnResult {
  message: PublicMessage;
  sources: CitationSource[];
}

export interface ConversationServiceDependencies {
  createConversation(userId: string): Promise<ConversationRecord>;
  listConversations(userId: string, page: number, limit: number): Promise<ConversationPageRecord>;
  findConversation(conversationId: string, userId: string): Promise<ConversationRecord | null>;
  findConversationDetail(
    conversationId: string,
    userId: string,
  ): Promise<ConversationDetailRecord | null>;
  createUserMessage(
    conversationId: string,
    userId: string,
    content: string,
  ): Promise<PublicMessageRecord>;
  completeTurn(input: CompleteConversationTurnInput): Promise<PublicMessageRecord>;
  deleteUserMessage(messageId: string, conversationId: string, userId: string): Promise<boolean>;
  findFirstUserMessage(
    conversationId: string,
    userId: string,
  ): Promise<FirstConversationUserMessage | null>;
  loadRecentContext(
    conversationId: string,
    userId: string,
    excludedMessageId: string,
    limit: number,
  ): Promise<ConversationContextMessageRecord[]>;
  saveTitle(conversationId: string, userId: string, title: string): Promise<boolean>;
  reserveTurn(userId: string): Promise<AiTurnReservationDecision>;
  releaseTurn(reservationId: string, userId: string): Promise<void>;
  retrieve(userId: string, question: string): Promise<RetrievedChunk[]>;
  generateAnswer(
    userId: string,
    input: {
      systemInstructions: string;
      conversationContext?: string;
      context: string;
      userQuestion: string;
    },
  ): Promise<GeneratedChatAnswer>;
  generateTitle(userId: string, firstQuestion: string): Promise<string>;
}

const CONVERSATION_PREVIEW_MAX_LENGTH = 80;
const CONVERSATION_TITLE_MAX_WORDS = 7;
const CONVERSATION_TITLE_MAX_LENGTH = 80;
const TITLE_GENERATION_INSTRUCTIONS = `Create a short title for a developer knowledge-base conversation.

Requirements:
- Use only the user's first question.
- Return only the title, without explanation, labels, quotation marks, or Markdown.
- Use at most 7 words.
- Make it descriptive and human readable.
- Avoid unnecessary punctuation.`;
const TITLE_GENERATION_CONTEXT =
  'No document context is required. The title must be based only on the user question.';

const defaultDependencies: ConversationServiceDependencies = {
  createConversation,
  listConversations: findActiveConversationPageByUserId,
  findConversation: findActiveConversationByIdForUser,
  findConversationDetail: findActiveConversationDetailByIdForUser,
  createUserMessage: createConversationUserMessage,
  completeTurn: completeConversationTurn,
  deleteUserMessage: deleteConversationUserMessage,
  findFirstUserMessage: findFirstConversationUserMessage,
  loadRecentContext: findRecentConversationContextMessages,
  saveTitle: setConversationTitleIfEmpty,
  reserveTurn: reserveAiTurn,
  releaseTurn: releaseAiTurn,
  retrieve: (userId, question) => retrievalService.search(userId, question),
  generateAnswer: (userId, input) =>
    aiBudgetService.generateChatAnswer(userId, AiOperation.ANSWER_GENERATION, input),
  generateTitle: async (userId, firstQuestion) => {
    const result = await aiBudgetService.generateChatAnswer(
      userId,
      AiOperation.TITLE_GENERATION,
      {
        systemInstructions: TITLE_GENERATION_INSTRUCTIONS,
        context: TITLE_GENERATION_CONTEXT,
        userQuestion: firstQuestion,
      },
      64,
    );

    return result.answer;
  },
};

function conversationNotFoundError(): AppError {
  return new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation was not found');
}

function toPublicMessage(message: PublicMessageRecord): PublicMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  };
}

function truncateAtWordBoundary(value: string, maxLength: number): string {
  const characters = Array.from(value);

  if (characters.length <= maxLength) {
    return value;
  }

  const shortened = characters
    .slice(0, maxLength - 3)
    .join('')
    .trimEnd();
  const lastSpace = shortened.lastIndexOf(' ');
  const boundary =
    lastSpace >= Math.floor(maxLength / 2) ? shortened.slice(0, lastSpace) : shortened;

  return `${boundary}...`;
}

function toConversationPreview(content: string): string {
  return truncateAtWordBoundary(
    content.replace(/\s+/g, ' ').trim(),
    CONVERSATION_PREVIEW_MAX_LENGTH,
  );
}

function toPublicConversationSummary(
  conversation: ConversationListRecord,
): PublicConversationSummary {
  return {
    id: conversation.id,
    title: conversation.title,
    preview: conversation.messages[0]
      ? toConversationPreview(conversation.messages[0].content)
      : null,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

function normalizeGeneratedTitle(value: string): string | null {
  const firstLine = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return null;
  }

  const cleaned = firstLine
    .replace(/^#{1,6}\s*/, '')
    .replace(/^(?:conversation\s+)?title\s*:\s*/i, '')
    .replace(/^[\s"'“”‘’`*_]+|[\s"'“”‘’`*_]+$/g, '')
    .replace(/[.!?,;:]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return null;
  }

  const limitedWords = cleaned.split(' ').slice(0, CONVERSATION_TITLE_MAX_WORDS).join(' ');
  const characters = Array.from(limitedWords);

  if (characters.length <= CONVERSATION_TITLE_MAX_LENGTH) {
    return limitedWords;
  }

  const shortened = characters.slice(0, CONVERSATION_TITLE_MAX_LENGTH).join('').trimEnd();
  const lastSpace = shortened.lastIndexOf(' ');

  return (lastSpace > 0 ? shortened.slice(0, lastSpace) : shortened).trim() || null;
}

async function maybeGenerateConversationTitle(
  dependencies: ConversationServiceDependencies,
  conversation: ConversationRecord,
  userMessage: PublicMessageRecord,
  userId: string,
): Promise<void> {
  if (conversation.title !== null) {
    return;
  }

  try {
    const firstUserMessage = await dependencies.findFirstUserMessage(conversation.id, userId);

    if (!firstUserMessage || firstUserMessage.id !== userMessage.id) {
      return;
    }

    const generatedTitle = normalizeGeneratedTitle(
      await dependencies.generateTitle(userId, firstUserMessage.content),
    );

    if (!generatedTitle) {
      console.error('Conversation title generation returned no usable title', {
        conversationId: conversation.id,
      });
      return;
    }

    await dependencies.saveTitle(conversation.id, userId, generatedTitle);
  } catch {
    console.error('Conversation title generation failed', {
      conversationId: conversation.id,
    });
  }
}

function isCitationSource(value: unknown): value is CitationSource {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const source = value as Record<string, unknown>;

  return (
    typeof source.label === 'string' &&
    typeof source.documentId === 'string' &&
    typeof source.documentName === 'string' &&
    typeof source.chunkId === 'string' &&
    typeof source.chunkPosition === 'number' &&
    (typeof source.page === 'number' || source.page === null)
  );
}

function citationSources(value: unknown): CitationSource[] {
  return Array.isArray(value) ? value.filter(isCitationSource) : [];
}

function citationSnapshot(
  sources: CitationSource[],
): Array<Record<string, string | number | null>> {
  return sources.map((source) => ({
    label: source.label,
    documentId: source.documentId,
    documentName: source.documentName,
    chunkId: source.chunkId,
    chunkPosition: source.chunkPosition,
    page: source.page,
  }));
}

function toPublicConversationDetail(
  conversation: ConversationDetailRecord,
): PublicConversationDetail {
  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messages: conversation.messages.map((message) => ({
      ...toPublicMessage(message),
      sources: citationSources(message.citations),
    })),
  };
}

function aiMetadata(answer: GeneratedChatAnswer): Record<string, string | number> {
  return {
    provider: answer.provider,
    model: answer.model,
    generationDurationMs: answer.generationDurationMs,
    ...(answer.usage
      ? {
          inputTokenCount: answer.usage.inputTokens,
          outputTokenCount: answer.usage.outputTokens,
          totalTokenCount: answer.usage.totalTokens,
          ...(answer.usage.cachedInputTokens === undefined
            ? {}
            : { cachedInputTokenCount: answer.usage.cachedInputTokens }),
          ...(answer.usage.reasoningTokens === undefined
            ? {}
            : { reasoningTokenCount: answer.usage.reasoningTokens }),
        }
      : {}),
  };
}

async function compensateFailedTurn(
  dependencies: ConversationServiceDependencies,
  userMessage: PublicMessageRecord,
  conversationId: string,
  userId: string,
): Promise<void> {
  try {
    const deleted = await dependencies.deleteUserMessage(userMessage.id, conversationId, userId);

    if (!deleted) {
      console.error('Failed to compensate an incomplete conversation turn', {
        conversationId,
        userMessageId: userMessage.id,
      });
    }
  } catch (error) {
    console.error('Failed to compensate an incomplete conversation turn', {
      conversationId,
      userMessageId: userMessage.id,
      error,
    });
  }
}

export function createConversationService(
  dependencies: ConversationServiceDependencies = defaultDependencies,
) {
  return {
    create(userId: string): Promise<ConversationRecord> {
      return dependencies.createConversation(userId);
    },

    async list(
      userId: string,
      query: ConversationListQuery,
    ): Promise<PublicConversationListResult> {
      const result = await dependencies.listConversations(userId, query.page, query.limit);

      return {
        conversations: result.conversations.map(toPublicConversationSummary),
        meta: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          totalPages: result.total === 0 ? 0 : Math.ceil(result.total / query.limit),
        },
      };
    },

    async get(conversationId: string, userId: string): Promise<PublicConversationDetail> {
      const conversation = await dependencies.findConversationDetail(conversationId, userId);

      if (!conversation) {
        throw conversationNotFoundError();
      }

      return toPublicConversationDetail(conversation);
    },

    async addMessage(
      conversationId: string,
      userId: string,
      content: string,
    ): Promise<ConversationTurnResult> {
      const conversation = await dependencies.findConversation(conversationId, userId);

      if (!conversation) {
        throw conversationNotFoundError();
      }

      const turnReservation = await dependencies.reserveTurn(userId);

      if (!turnReservation.allowed) {
        throw new AppError(
          429,
          'AI_DAILY_LIMIT_REACHED',
          "You've reached today's AI usage limit. Try again later.",
        );
      }

      let userMessage: PublicMessageRecord;

      try {
        userMessage = await dependencies.createUserMessage(conversationId, userId, content);
      } catch (error) {
        await dependencies.releaseTurn(turnReservation.reservationId, userId);
        if (error instanceof ActiveConversationNotFoundError) {
          throw conversationNotFoundError();
        }

        throw error;
      }

      try {
        const recentMessages = await dependencies.loadRecentContext(
          conversationId,
          userId,
          userMessage.id,
          MAX_CONVERSATION_CONTEXT_MESSAGES,
        );
        const conversationContext = buildBoundedConversationContext(
          recentMessages.map((message) => ({
            role: message.role === 'USER' ? ('USER' as const) : ('ASSISTANT' as const),
            content: message.content,
          })),
        );
        const retrievalQuery = buildContextAwareRetrievalQuery(content, conversationContext);
        let chunks: RetrievedChunk[];

        try {
          chunks = await dependencies.retrieve(userId, retrievalQuery);
        } catch (error) {
          if (error instanceof AppError) {
            throw error;
          }

          throw new AppError(500, 'RETRIEVAL_FAILED', 'Unable to retrieve document context');
        }

        if (chunks.length === 0) {
          const message = await dependencies.completeTurn({
            conversationId,
            userId,
            content: INSUFFICIENT_CONTEXT_ANSWER,
            citations: [],
            sourceChunkIds: [],
          });

          await dependencies.releaseTurn(turnReservation.reservationId, userId);

          await maybeGenerateConversationTitle(dependencies, conversation, userMessage, userId);

          return {
            message: toPublicMessage(message),
            sources: [],
          };
        }

        const prompt = buildGroundedPrompt(content, chunks, conversationContext);
        let answer: GeneratedChatAnswer;

        try {
          answer = await dependencies.generateAnswer(userId, {
            systemInstructions: prompt.systemInstructions,
            ...(prompt.conversationContext
              ? { conversationContext: prompt.conversationContext }
              : {}),
            context: prompt.context,
            userQuestion: prompt.userQuestion,
          });
        } catch (error) {
          if (error instanceof AiBudgetUnavailableError) {
            throw new AppError(
              503,
              'AI_TEMPORARILY_UNAVAILABLE',
              'AI features are temporarily unavailable.',
            );
          }
          throw new AppError(
            503,
            'AI_PROVIDER_UNAVAILABLE',
            'Answer generation is temporarily unavailable',
          );
        }

        let citedSources: CitationSource[];

        try {
          citedSources = selectCitedSources(answer.answer, prompt.sources);
        } catch {
          throw new AppError(
            502,
            'INVALID_AI_RESPONSE',
            'Answer generation returned an invalid response',
          );
        }

        let message: PublicMessageRecord;

        try {
          message = await dependencies.completeTurn({
            conversationId,
            userId,
            content: answer.answer,
            citations: citationSnapshot(citedSources),
            aiMetadata: aiMetadata(answer),
            sourceChunkIds: citedSources.map((source) => source.chunkId),
            aiTurnReservationId: turnReservation.reservationId,
          });
        } catch (error) {
          if (error instanceof ActiveConversationNotFoundError) {
            throw conversationNotFoundError();
          }

          throw new AppError(
            500,
            'MESSAGE_PERSISTENCE_FAILED',
            'Unable to save the generated answer',
          );
        }

        await maybeGenerateConversationTitle(dependencies, conversation, userMessage, userId);

        return {
          message: toPublicMessage(message),
          sources: citedSources,
        };
      } catch (error) {
        await compensateFailedTurn(dependencies, userMessage, conversationId, userId);
        await dependencies.releaseTurn(turnReservation.reservationId, userId);
        throw error;
      }
    },
  };
}

export const conversationService = createConversationService();
