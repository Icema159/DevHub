import type { AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient, ApiClientError } from '../../lib/api-client';
import {
  createConversation,
  conversationMessageValidationError,
  getConversation,
  isValidConversationId,
  listConversations,
  MAX_CONVERSATION_MESSAGE_LENGTH,
  normalizeConversationMessageContent,
  sendConversationMessage,
  streamConversationMessage,
} from './conversations.service';

const conversation = {
  id: 'conversation-id',
  title: null,
  createdAt: '2026-07-29T08:00:00.000Z',
  updatedAt: '2026-07-29T08:00:00.000Z',
};

const listResponse = {
  data: {
    conversations: [
      {
        ...conversation,
        preview: null,
        userId: 'private-owner-id',
      },
    ],
  },
  meta: {
    page: 2,
    limit: 20,
    total: 24,
    totalPages: 2,
  },
};

const detailResponse = {
  data: {
    conversation: {
      ...conversation,
      userId: 'private-owner-id',
      deletedAt: null,
      messages: [
        {
          id: 'message-id',
          role: 'USER',
          content: '<img src=x onerror=alert(1)>',
          createdAt: '2026-07-29T08:01:00.000Z',
          sources: [],
          aiMetadata: { provider: 'private-provider' },
        },
      ],
    },
  },
};

const messageResponse = {
  data: {
    message: {
      id: 'assistant-message-id',
      role: 'ASSISTANT',
      content: 'Use an HttpOnly cookie [S1].',
      createdAt: '2026-07-29T08:02:00.000Z',
      aiMetadata: { provider: 'private-provider' },
    },
    sources: [
      {
        label: 'S1',
        documentId: 'document-id',
        documentName: 'Authentication Guide.pdf',
        chunkId: 'chunk-id',
        chunkPosition: 4,
        page: 12,
        similarity: 0.98,
      },
    ],
  },
};

function responseWith(data: unknown, status = 200): AxiosResponse<unknown> {
  return {
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: { headers: {} },
  } as AxiosResponse<unknown>;
}

function byteStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Conversations service', () => {
  it('lists through the confirmed GET endpoint with only supported pagination and signal', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(responseWith(listResponse));
    const controller = new AbortController();

    await listConversations(
      { page: 2, limit: 20, unsupported: 'ignored' } as {
        page: number;
        limit: number;
        unsupported: string;
      },
      { signal: controller.signal },
    );

    expect(get).toHaveBeenCalledWith('/api/conversations', {
      params: { page: 2, limit: 20 },
      signal: controller.signal,
    });
  });

  it('omits unspecified pagination parameters', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(responseWith(listResponse));

    await listConversations();

    expect(get).toHaveBeenCalledWith('/api/conversations', { params: {} });
  });

  it('preserves backend ordering, nullable fields, pagination, and strips private list fields', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(responseWith(listResponse));

    const result = await listConversations({ page: 2, limit: 20 });

    expect(result).toEqual({
      conversations: [
        {
          ...conversation,
          preview: null,
        },
      ],
      meta: listResponse.meta,
    });
    expect(result.conversations[0]).not.toHaveProperty('userId');
  });

  it.each([
    {
      name: 'invalid pagination',
      response: { ...listResponse, meta: { ...listResponse.meta, page: 0 } },
    },
    {
      name: 'invalid timestamp',
      response: {
        ...listResponse,
        data: {
          conversations: [{ ...listResponse.data.conversations[0], updatedAt: 'invalid-date' }],
        },
      },
    },
    {
      name: 'invalid ID',
      response: {
        ...listResponse,
        data: { conversations: [{ ...listResponse.data.conversations[0], id: 'bad/id' }] },
      },
    },
  ])('rejects a malformed list response safely: $name', async ({ response }) => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(responseWith(response));

    await expect(listConversations()).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
      message: 'The service returned an unexpected response. Try again.',
    });
  });

  it('creates through POST without a body and returns only the confirmed server record', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(
      responseWith(
        {
          data: {
            conversation: {
              ...conversation,
              userId: 'private-owner-id',
            },
          },
        },
        201,
      ),
    );

    const result = await createConversation();

    expect(post).toHaveBeenCalledWith('/api/conversations');
    expect(result).toEqual(conversation);
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('preview');
  });

  it('rejects a malformed create response safely', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue(
      responseWith({ data: { conversation: { id: 'conversation-id' } } }, 201),
    );

    await expect(createConversation()).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
    });
  });

  it('gets detail through an encoded GET route and validates messages without exposing internals', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(responseWith(detailResponse));
    const controller = new AbortController();

    const result = await getConversation('conversation/id?owner=other', {
      signal: controller.signal,
    });

    expect(get).toHaveBeenCalledWith('/api/conversations/conversation%2Fid%3Fowner%3Dother', {
      signal: controller.signal,
    });
    expect(result.messages[0]).toEqual({
      id: 'message-id',
      role: 'USER',
      content: '<img src=x onerror=alert(1)>',
      createdAt: '2026-07-29T08:01:00.000Z',
      sources: [],
    });
    expect(result).not.toHaveProperty('userId');
    expect(result.messages[0]).not.toHaveProperty('aiMetadata');
  });

  it('preserves ordered ASSISTANT sources with positive pages and nullable pages', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      responseWith({
        data: {
          conversation: {
            ...conversation,
            messages: [
              {
                id: 'assistant-message-id',
                role: 'ASSISTANT',
                content: 'Grounded answer.',
                createdAt: '2026-07-29T08:02:00.000Z',
                sources: [
                  { ...messageResponse.data.sources[0], page: 12 },
                  {
                    ...messageResponse.data.sources[0],
                    label: 'S2',
                    chunkId: 'second-chunk-id',
                    page: null,
                  },
                ],
              },
            ],
          },
        },
      }),
    );

    const result = await getConversation('conversation-id');

    expect(result.messages[0]?.sources).toEqual([
      {
        label: 'S1',
        documentId: 'document-id',
        documentName: 'Authentication Guide.pdf',
        chunkId: 'chunk-id',
        chunkPosition: 4,
        page: 12,
      },
      {
        label: 'S2',
        documentId: 'document-id',
        documentName: 'Authentication Guide.pdf',
        chunkId: 'second-chunk-id',
        chunkPosition: 4,
        page: null,
      },
    ]);
  });

  it.each([
    { name: 'zero', page: 0 },
    { name: 'negative', page: -1 },
    { name: 'fractional', page: 1.5 },
    { name: 'numeric string', page: '12' },
    { name: 'missing', page: undefined },
  ])('rejects an invalid source page from conversation history: $name', async ({ page }) => {
    const source = { ...messageResponse.data.sources[0], page };

    if (page === undefined) {
      delete (source as { page?: unknown }).page;
    }

    vi.spyOn(apiClient, 'get').mockResolvedValue(
      responseWith({
        data: {
          conversation: {
            ...conversation,
            messages: [
              {
                id: 'assistant-message-id',
                role: 'ASSISTANT',
                content: 'Grounded answer.',
                createdAt: '2026-07-29T08:02:00.000Z',
                sources: [source],
              },
            ],
          },
        },
      }),
    );

    await expect(getConversation('conversation-id')).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
      kind: 'unexpected',
    });
  });

  it.each(['[S1]', 'source-1', 'S0', 's1'])(
    'rejects an unexpected source label: %s',
    async (label) => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        responseWith({
          data: {
            conversation: {
              ...conversation,
              messages: [
                {
                  id: 'assistant-message-id',
                  role: 'ASSISTANT',
                  content: 'Grounded answer.',
                  createdAt: '2026-07-29T08:02:00.000Z',
                  sources: [{ ...messageResponse.data.sources[0], label }],
                },
              ],
            },
          },
        }),
      );

      await expect(getConversation('conversation-id')).rejects.toMatchObject({
        code: 'INVALID_API_RESPONSE',
        kind: 'unexpected',
      });
    },
  );

  it('rejects source metadata attached to a USER message', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      responseWith({
        data: {
          conversation: {
            ...conversation,
            messages: [
              {
                ...detailResponse.data.conversation.messages[0],
                sources: [messageResponse.data.sources[0]],
              },
            ],
          },
        },
      }),
    );

    await expect(getConversation('conversation-id')).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
      kind: 'unexpected',
    });
  });

  it('rejects an invalid detail response', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      responseWith({
        data: {
          conversation: {
            ...conversation,
            messages: [{ id: 'message-id', role: 'OWNER' }],
          },
        },
      }),
    );

    await expect(getConversation('conversation-id')).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
    });
  });

  it('rejects SYSTEM messages because they are not part of the public Chat thread', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      responseWith({
        data: {
          conversation: {
            ...conversation,
            messages: [
              {
                id: 'system-message-id',
                role: 'SYSTEM',
                content: 'Private system instructions',
                createdAt: '2026-07-29T08:01:00.000Z',
                sources: [],
              },
            ],
          },
        },
      }),
    );

    await expect(getConversation('conversation-id')).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
    });
  });

  it('submits only trimmed content to the encoded message endpoint and validates the 201 result', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(responseWith(messageResponse, 201));
    const content = normalizeConversationMessageContent('  Where should I store it?  ');

    const result = await sendConversationMessage('conversation/id?owner=other', content);

    expect(post).toHaveBeenCalledWith(
      '/api/conversations/conversation%2Fid%3Fowner%3Dother/messages',
      { content: 'Where should I store it?' },
    );
    expect(post).toHaveBeenCalledOnce();
    expect(result).toEqual({
      message: {
        id: 'assistant-message-id',
        role: 'ASSISTANT',
        content: 'Use an HttpOnly cookie [S1].',
        createdAt: '2026-07-29T08:02:00.000Z',
      },
      sources: [
        {
          label: 'S1',
          documentId: 'document-id',
          documentName: 'Authentication Guide.pdf',
          chunkId: 'chunk-id',
          chunkPosition: 4,
          page: 12,
        },
      ],
    });
    expect(result.message).not.toHaveProperty('aiMetadata');
    expect(result.sources[0]).not.toHaveProperty('similarity');
  });

  it.each([
    {
      name: 'wrong success status',
      response: messageResponse,
      status: 200,
    },
    {
      name: 'USER response role',
      response: {
        data: {
          ...messageResponse.data,
          message: { ...messageResponse.data.message, role: 'USER' },
        },
      },
      status: 201,
    },
    {
      name: 'invalid message timestamp',
      response: {
        data: {
          ...messageResponse.data,
          message: { ...messageResponse.data.message, createdAt: 'not-a-date' },
        },
      },
      status: 201,
    },
    {
      name: 'nullable sources outside the confirmed contract',
      response: { data: { ...messageResponse.data, sources: null } },
      status: 201,
    },
    {
      name: 'invalid source page',
      response: {
        data: {
          ...messageResponse.data,
          sources: [{ ...messageResponse.data.sources[0], page: 0 }],
        },
      },
      status: 201,
    },
  ])('rejects a malformed message response safely: $name', async ({ response, status }) => {
    vi.spyOn(apiClient, 'post').mockResolvedValue(responseWith(response, status));

    await expect(sendConversationMessage('conversation-id', 'Question')).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
      kind: 'unexpected',
    });
  });

  it('preserves normalized message API and authentication failures', async () => {
    const error = new ApiClientError({
      code: 'UNAUTHENTICATED',
      kind: 'unauthenticated',
      message: 'Your session has expired. Sign in to continue.',
      status: 401,
    });
    vi.spyOn(apiClient, 'post').mockRejectedValue(error);

    await expect(sendConversationMessage('conversation-id', 'Question')).rejects.toBe(error);
  });

  it('streams progressive events and returns only the validated final persisted turn', async () => {
    const stream = byteStream([
      'event: status\ndata: {"type":"status","phase":"retrieving"}\n\nevent: delta\nda',
      'ta: {"type":"delta","delta":"Use an "}\n\nevent: delta\ndata: {"type":"delta","delta":"HttpOnly cookie [S1]."}\n\n',
      `event: completed\ndata: ${JSON.stringify({ type: 'completed', result: messageResponse.data })}\n\n`,
    ]);
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(responseWith(stream, 200));
    const onEvent = vi.fn();
    const controller = new AbortController();

    const result = await streamConversationMessage('conversation/id', 'Question', {
      onEvent,
      signal: controller.signal,
    });

    expect(post).toHaveBeenCalledWith(
      '/api/conversations/conversation%2Fid/messages/stream',
      { content: 'Question' },
      expect.objectContaining({
        adapter: 'fetch',
        responseType: 'stream',
        signal: controller.signal,
        timeout: 0,
      }),
    );
    expect(onEvent.mock.calls.map(([event]) => event.type)).toEqual([
      'status',
      'delta',
      'delta',
      'completed',
    ]);
    expect(result.message.content).toBe('Use an HttpOnly cookie [S1].');
    expect(result.sources[0]?.label).toBe('S1');
  });

  it('rejects a safe server stream error without accepting partial output as completion', async () => {
    const stream = byteStream([
      'event: delta\ndata: {"type":"delta","delta":"Partial"}\n\n',
      'event: error\ndata: {"code":"AI_PROVIDER_UNAVAILABLE","message":"Answer generation is temporarily unavailable","status":503}\n\n',
    ]);
    vi.spyOn(apiClient, 'post').mockResolvedValue(responseWith(stream, 200));

    await expect(
      streamConversationMessage('conversation-id', 'Question', { onEvent: vi.fn() }),
    ).rejects.toMatchObject({
      code: 'AI_PROVIDER_UNAVAILABLE',
      kind: 'server',
      status: 503,
    });
  });

  it('rejects a malformed or truncated stream that has no completion event', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue(
      responseWith(byteStream(['event: delta\ndata: {"type":"delta","delta":"Partial"}\n\n']), 200),
    );

    await expect(
      streamConversationMessage('conversation-id', 'Question', { onEvent: vi.fn() }),
    ).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
  });

  it('matches backend trimming, whitespace, and 4,000-character validation', () => {
    expect(normalizeConversationMessageContent('  Labas\n')).toBe('Labas');
    expect(conversationMessageValidationError(' \n\t ')).toBe('Enter a message before sending.');
    expect(conversationMessageValidationError('x'.repeat(MAX_CONVERSATION_MESSAGE_LENGTH))).toBe(
      null,
    );
    expect(
      conversationMessageValidationError('x'.repeat(MAX_CONVERSATION_MESSAGE_LENGTH + 1)),
    ).toContain('4,000');
  });

  it('preserves normalized API and authentication errors from the shared client', async () => {
    const error = new ApiClientError({
      code: 'UNAUTHENTICATED',
      kind: 'unauthenticated',
      message: 'Your session has expired. Sign in to continue.',
      status: 401,
    });
    vi.spyOn(apiClient, 'get').mockRejectedValue(error);

    await expect(listConversations()).rejects.toBe(error);
  });

  it('validates conversation IDs using the backend route rules', () => {
    expect(isValidConversationId('cm123_conversation-id')).toBe(true);
    expect(isValidConversationId('')).toBe(false);
    expect(isValidConversationId('conversation/id')).toBe(false);
    expect(isValidConversationId('x'.repeat(129))).toBe(false);
  });
});
