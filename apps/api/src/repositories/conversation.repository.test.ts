import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { DocumentStatus, MessageRole } from '../../../../generated/prisma/client.js';
import { disconnectPrisma, prisma } from '../config/prisma.js';
import {
  completeConversationTurn,
  ConversationSourceConflictError,
  createConversationUserMessage,
  findActiveConversationDetailByIdForUser,
  findActiveConversationPageByUserId,
  findFirstConversationUserMessage,
  findRecentConversationContextMessages,
  setConversationTitleIfEmpty,
} from './conversation.repository.js';

test('persists an owner-scoped conversation turn and excludes soft-deleted conversations', async () => {
  const suffix = randomUUID();
  const userAId = `conversation-user-a-${suffix}`;
  const userBId = `conversation-user-b-${suffix}`;
  const activeConversationId = `active-conversation-${suffix}`;
  const deletedConversationId = `deleted-conversation-${suffix}`;
  const foreignConversationId = `foreign-conversation-${suffix}`;
  const documentId = `conversation-document-${suffix}`;
  const chunkId = `conversation-chunk-${suffix}`;
  const foreignDocumentId = `conversation-foreign-document-${suffix}`;
  const foreignChunkId = `conversation-foreign-chunk-${suffix}`;
  const nonReadyDocumentId = `conversation-non-ready-document-${suffix}`;
  const nonReadyChunkId = `conversation-non-ready-chunk-${suffix}`;
  const systemMessageId = `conversation-system-message-${suffix}`;

  try {
    await prisma.user.createMany({
      data: [
        { id: userAId, email: `${userAId}@example.com`, passwordHash: 'test-only' },
        { id: userBId, email: `${userBId}@example.com`, passwordHash: 'test-only' },
      ],
    });
    await prisma.conversation.createMany({
      data: [
        { id: activeConversationId, userId: userAId },
        { id: deletedConversationId, userId: userAId, deletedAt: new Date() },
        { id: foreignConversationId, userId: userBId },
      ],
    });
    await prisma.document.create({
      data: {
        id: documentId,
        userId: userAId,
        name: 'Authentication.pdf',
        storageKey: `tests/${documentId}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1,
        fileHash: `hash-${documentId}`,
        status: DocumentStatus.READY,
        chunks: {
          create: {
            id: chunkId,
            position: 3,
            content: 'JWT access tokens are stored in HttpOnly cookies.',
            metadata: { pageNumber: 12 },
          },
        },
      },
    });
    await prisma.document.create({
      data: {
        id: foreignDocumentId,
        userId: userBId,
        name: 'Foreign Authentication.pdf',
        storageKey: `tests/${foreignDocumentId}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1,
        fileHash: `hash-${foreignDocumentId}`,
        status: DocumentStatus.READY,
        chunks: {
          create: {
            id: foreignChunkId,
            position: 0,
            content: 'Foreign-owned content must not become an owner citation.',
          },
        },
      },
    });
    await prisma.document.create({
      data: {
        id: nonReadyDocumentId,
        userId: userAId,
        name: 'Still Processing.pdf',
        storageKey: `tests/${nonReadyDocumentId}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1,
        fileHash: `hash-${nonReadyDocumentId}`,
        status: DocumentStatus.PROCESSING,
        chunks: {
          create: {
            id: nonReadyChunkId,
            position: 0,
            content: 'Non-ready content must not become a citation.',
          },
        },
      },
    });

    const conversationPage = await findActiveConversationPageByUserId(userAId, 1, 20);

    assert.deepEqual(
      conversationPage.conversations.map((item) => item.id),
      [activeConversationId],
    );
    assert.equal(conversationPage.total, 1);
    assert.equal(
      await findActiveConversationDetailByIdForUser(activeConversationId, userBId),
      null,
    );
    assert.equal(
      await findActiveConversationDetailByIdForUser(deletedConversationId, userAId),
      null,
    );

    const userMessage = await createConversationUserMessage(
      activeConversationId,
      userAId,
      'How does auth work?',
    );
    const assistantMessage = await completeConversationTurn({
      conversationId: activeConversationId,
      userId: userAId,
      content: 'Authentication uses JWT cookies [S1].',
      citations: [
        {
          label: 'S1',
          documentId,
          documentName: 'Authentication.pdf',
          chunkId,
          chunkPosition: 3,
          page: 12,
        },
      ],
      aiMetadata: {
        provider: 'mock-openai',
        model: 'mock-model',
        inputTokenCount: 100,
        outputTokenCount: 10,
        totalTokenCount: 110,
      },
      sourceChunkIds: [chunkId],
    });
    await prisma.message.update({
      where: { id: userMessage.id },
      data: { createdAt: new Date('2026-07-24T09:00:00.000Z') },
    });
    await prisma.message.update({
      where: { id: assistantMessage.id },
      data: { createdAt: new Date('2026-07-24T09:01:00.000Z') },
    });
    await prisma.message.create({
      data: {
        id: systemMessageId,
        conversationId: activeConversationId,
        role: MessageRole.SYSTEM,
        content: 'Internal system instructions must never become public conversation history.',
        createdAt: new Date('2026-07-24T09:00:30.000Z'),
      },
    });

    const detail = await findActiveConversationDetailByIdForUser(activeConversationId, userAId);
    const storedAssistant = await prisma.message.findUniqueOrThrow({
      where: { id: assistantMessage.id },
      select: {
        citations: true,
        aiMetadata: true,
        sourceChunks: { select: { id: true } },
      },
    });

    assert.deepEqual(
      detail?.messages.map((item) => item.role),
      [MessageRole.USER, MessageRole.ASSISTANT],
    );
    assert.equal(
      detail?.messages.some((item) => item.id === systemMessageId),
      false,
    );
    assert.notDeepEqual(storedAssistant.citations, storedAssistant.aiMetadata);
    assert.deepEqual(storedAssistant.sourceChunks, [{ id: chunkId }]);
    assert.deepEqual(await findFirstConversationUserMessage(activeConversationId, userAId), {
      id: userMessage.id,
      content: 'How does auth work?',
    });
    assert.equal(
      await setConversationTitleIfEmpty(activeConversationId, userAId, 'JWT Authentication Basics'),
      true,
    );
    assert.equal(
      await setConversationTitleIfEmpty(activeConversationId, userAId, 'Must Not Replace'),
      false,
    );
    assert.equal(
      (
        await prisma.conversation.findUniqueOrThrow({
          where: { id: activeConversationId },
          select: { title: true },
        })
      ).title,
      'JWT Authentication Basics',
    );

    const contextMessageIds = Array.from(
      { length: 8 },
      (_value, index) => `conversation-context-${index}-${suffix}`,
    );
    await prisma.message.createMany({
      data: [
        ...contextMessageIds.map((id, index) => ({
          id,
          conversationId: activeConversationId,
          role: index % 2 === 0 ? MessageRole.USER : MessageRole.ASSISTANT,
          content: `Context message ${index}`,
          createdAt: new Date(`2026-07-24T10:0${index}:00.000Z`),
        })),
        {
          id: `foreign-context-${suffix}`,
          conversationId: foreignConversationId,
          role: MessageRole.USER,
          content: 'Foreign conversation context',
          createdAt: new Date('2026-07-24T11:00:00.000Z'),
        },
        {
          id: `deleted-context-${suffix}`,
          conversationId: deletedConversationId,
          role: MessageRole.USER,
          content: 'Deleted conversation context',
          createdAt: new Date('2026-07-24T12:00:00.000Z'),
        },
      ],
    });

    const recentContext = await findRecentConversationContextMessages(
      activeConversationId,
      userAId,
      contextMessageIds[7]!,
      6,
    );

    assert.deepEqual(
      recentContext.map((message) => message.id),
      contextMessageIds.slice(1, 7),
    );
    assert.equal(
      recentContext.some((message) => message.content.includes('Foreign')),
      false,
    );
    assert.deepEqual(
      await findRecentConversationContextMessages(
        activeConversationId,
        userBId,
        contextMessageIds[7]!,
        6,
      ),
      [],
    );
    assert.deepEqual(
      await findRecentConversationContextMessages(foreignConversationId, userAId, 'not-present', 6),
      [],
    );
    assert.deepEqual(
      await findRecentConversationContextMessages(deletedConversationId, userAId, 'not-present', 6),
      [],
    );

    const assistantCountBeforeRejectedSources = await prisma.message.count({
      where: {
        conversationId: activeConversationId,
        role: MessageRole.ASSISTANT,
      },
    });

    for (const rejectedChunkId of [foreignChunkId, nonReadyChunkId]) {
      await assert.rejects(
        () =>
          completeConversationTurn({
            conversationId: activeConversationId,
            userId: userAId,
            content: 'This answer must not be persisted.',
            citations: [],
            sourceChunkIds: [rejectedChunkId],
          }),
        (error) => error instanceof ConversationSourceConflictError,
      );
    }

    assert.equal(
      await prisma.message.count({
        where: {
          conversationId: activeConversationId,
          role: MessageRole.ASSISTANT,
        },
      }),
      assistantCountBeforeRejectedSources,
    );

    await prisma.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });
    await assert.rejects(
      () =>
        completeConversationTurn({
          conversationId: activeConversationId,
          userId: userAId,
          content: 'This answer must not be persisted.',
          citations: [],
          sourceChunkIds: [chunkId],
        }),
      (error) => error instanceof ConversationSourceConflictError,
    );
  } finally {
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId] } },
    });
    await disconnectPrisma();
  }
});
