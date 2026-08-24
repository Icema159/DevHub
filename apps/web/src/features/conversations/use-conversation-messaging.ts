import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiClientError, normalizeApiError } from '../../lib/api-client';
import {
  conversationMessageValidationError,
  normalizeConversationMessageContent,
  sendConversationMessage,
} from './conversations.service';
import type {
  ConversationTurnResult,
  PublicConversationMessage,
  SelectedConversationRefreshResult,
} from './conversations.types';

export type MessageSubmissionResource =
  | {
      error: null;
      status: 'idle' | 'submitting';
    }
  | {
      assistantMessageId: string;
      error: null;
      status: 'success';
    }
  | {
      error: ApiClientError;
      questionPersisted: boolean;
      status: 'error';
    };

export interface MessageSubmissionOutcome {
  clearDraft: boolean;
  status: 'success' | 'error' | 'detached';
}

export interface UseConversationMessagingOptions {
  conversationId: string | undefined;
  messages: PublicConversationMessage[];
  onConversationActivity: () => void;
  refreshConversation: () => Promise<SelectedConversationRefreshResult>;
}

interface ActiveRequest {
  conversationId: string;
  promise: Promise<MessageSubmissionOutcome>;
}

interface ScopedSubmissionState {
  conversationId: string;
  resource: MessageSubmissionResource;
}

const idleResource: MessageSubmissionResource = {
  error: null,
  status: 'idle',
};

function clientValidationError(message: string): ApiClientError {
  return new ApiClientError({
    code: 'INVALID_INPUT',
    kind: 'validation',
    message,
    status: 400,
  });
}

function refreshConfirmationError(): ApiClientError {
  return new ApiClientError({
    code: 'CONVERSATION_REFRESH_FAILED',
    kind: 'unexpected',
    message:
      'The answer was saved, but the conversation could not be refreshed. Try refreshing it.',
  });
}

function submissionAlreadyActiveError(): ApiClientError {
  return new ApiClientError({
    code: 'MESSAGE_SUBMISSION_IN_PROGRESS',
    kind: 'conflict',
    message: 'Wait for the active question to finish before sending another.',
  });
}

function shouldReconcile(error: ApiClientError): boolean {
  return !['INVALID_INPUT', 'UNAUTHENTICATED'].includes(error.code);
}

function hasNewMatchingUserMessage(
  messages: PublicConversationMessage[],
  previousMessageIds: ReadonlySet<string>,
  content: string,
): boolean {
  return messages.some(
    (message) =>
      message.role === 'USER' && message.content === content && !previousMessageIds.has(message.id),
  );
}

function recoveredTurnAssistantId(
  messages: PublicConversationMessage[],
  previousMessageIds: ReadonlySet<string>,
  content: string,
): string | null {
  const userIndex = messages.findIndex(
    (message) =>
      message.role === 'USER' && message.content === content && !previousMessageIds.has(message.id),
  );

  if (userIndex < 0) {
    return null;
  }

  return (
    messages
      .slice(userIndex + 1)
      .find((message) => message.role === 'ASSISTANT' && !previousMessageIds.has(message.id))?.id ??
    null
  );
}

export function messageSubmissionErrorMessage(resource: MessageSubmissionResource): string | null {
  if (resource.status !== 'error') {
    return null;
  }

  if (resource.error.code === 'CONVERSATION_REFRESH_FAILED') {
    return resource.error.message;
  }

  if (resource.questionPersisted) {
    return 'Your question was saved, but an answer could not be completed. Review the thread before trying again.';
  }

  if (resource.error.kind === 'network') {
    return 'Unable to reach the server. Check your connection and try again.';
  }

  if (resource.error.kind === 'validation') {
    return 'Review your message and try again.';
  }

  if (
    [
      'AI_PROVIDER_UNAVAILABLE',
      'INVALID_AI_RESPONSE',
      'MESSAGE_PERSISTENCE_FAILED',
      'RETRIEVAL_FAILED',
      'AI_TEMPORARILY_UNAVAILABLE',
    ].includes(resource.error.code) ||
    resource.error.kind === 'server'
  ) {
    return 'An answer could not be created right now. Try again.';
  }

  return resource.error.message;
}

export function useConversationMessaging({
  conversationId,
  messages,
  onConversationActivity,
  refreshConversation,
}: UseConversationMessagingOptions) {
  const routeConversationId = conversationId ?? '';
  const [state, setState] = useState<ScopedSubmissionState>({
    conversationId: routeConversationId,
    resource: idleResource,
  });
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const activeRequestRef = useRef<ActiveRequest | null>(null);
  const messagesRef = useRef(messages);
  const mountedRef = useRef(true);
  const onConversationActivityRef = useRef(onConversationActivity);
  const refreshConversationRef = useRef(refreshConversation);
  const routeConversationIdRef = useRef(routeConversationId);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    onConversationActivityRef.current = onConversationActivity;
  }, [onConversationActivity]);

  useEffect(() => {
    refreshConversationRef.current = refreshConversation;
  }, [refreshConversation]);

  useEffect(() => {
    routeConversationIdRef.current = routeConversationId;
  }, [routeConversationId]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const commitForConversation = useCallback(
    (requestConversationId: string, resource: MessageSubmissionResource) => {
      if (mountedRef.current && routeConversationIdRef.current === requestConversationId) {
        setState({ conversationId: requestConversationId, resource });
      }
    },
    [],
  );

  const submit = useCallback(
    (draft: string): Promise<MessageSubmissionOutcome> => {
      const requestConversationId = routeConversationIdRef.current;
      const validationError = conversationMessageValidationError(draft);

      if (!requestConversationId || validationError) {
        const error = clientValidationError(validationError ?? 'Conversation is unavailable.');
        commitForConversation(requestConversationId, {
          error,
          questionPersisted: false,
          status: 'error',
        });
        return Promise.resolve({ clearDraft: false, status: 'error' });
      }

      const activeRequest = activeRequestRef.current;

      if (activeRequest) {
        if (activeRequest.conversationId === requestConversationId) {
          return activeRequest.promise;
        }

        const error = submissionAlreadyActiveError();
        commitForConversation(requestConversationId, {
          error,
          questionPersisted: false,
          status: 'error',
        });
        return Promise.resolve({ clearDraft: false, status: 'error' });
      }

      const content = normalizeConversationMessageContent(draft);
      const previousMessageIds = new Set(messagesRef.current.map((message) => message.id));

      commitForConversation(requestConversationId, { error: null, status: 'submitting' });
      setActiveConversationId(requestConversationId);

      const request = (async (): Promise<MessageSubmissionOutcome> => {
        try {
          const turn: ConversationTurnResult = await sendConversationMessage(
            requestConversationId,
            content,
          );

          if (!mountedRef.current || routeConversationIdRef.current !== requestConversationId) {
            return { clearDraft: false, status: 'detached' };
          }

          const refreshed = await refreshConversationRef.current();

          if (!mountedRef.current || routeConversationIdRef.current !== requestConversationId) {
            return { clearDraft: false, status: 'detached' };
          }

          onConversationActivityRef.current();

          if (
            refreshed.status === 'success' &&
            refreshed.data.messages.some((message) => message.id === turn.message.id)
          ) {
            commitForConversation(requestConversationId, {
              assistantMessageId: turn.message.id,
              error: null,
              status: 'success',
            });
            return { clearDraft: true, status: 'success' };
          }

          if (refreshed.status === 'not-found') {
            return { clearDraft: true, status: 'success' };
          }

          commitForConversation(requestConversationId, {
            error: refreshConfirmationError(),
            questionPersisted: true,
            status: 'error',
          });
          return { clearDraft: true, status: 'error' };
        } catch (error) {
          const normalizedError = normalizeApiError(error);

          if (!mountedRef.current || routeConversationIdRef.current !== requestConversationId) {
            return { clearDraft: false, status: 'detached' };
          }

          let questionPersisted = false;
          let recoveredAssistantId: string | null = null;

          if (shouldReconcile(normalizedError)) {
            const refreshed = await refreshConversationRef.current();

            if (!mountedRef.current || routeConversationIdRef.current !== requestConversationId) {
              return { clearDraft: false, status: 'detached' };
            }

            if (refreshed.status === 'success') {
              questionPersisted = hasNewMatchingUserMessage(
                refreshed.data.messages,
                previousMessageIds,
                content,
              );
              recoveredAssistantId = recoveredTurnAssistantId(
                refreshed.data.messages,
                previousMessageIds,
                content,
              );
            }
          }

          if (recoveredAssistantId) {
            onConversationActivityRef.current();
            commitForConversation(requestConversationId, {
              assistantMessageId: recoveredAssistantId,
              error: null,
              status: 'success',
            });
            return { clearDraft: true, status: 'success' };
          }

          if (questionPersisted) {
            onConversationActivityRef.current();
          }

          commitForConversation(requestConversationId, {
            error: normalizedError,
            questionPersisted,
            status: 'error',
          });

          return { clearDraft: questionPersisted, status: 'error' };
        } finally {
          activeRequestRef.current = null;

          if (mountedRef.current) {
            setActiveConversationId(null);
          }
        }
      })();

      activeRequestRef.current = {
        conversationId: requestConversationId,
        promise: request,
      };

      return request;
    },
    [commitForConversation],
  );

  const resource = state.conversationId === routeConversationId ? state.resource : idleResource;

  return {
    isBusy: activeConversationId !== null,
    isSubmittingCurrent: activeConversationId === routeConversationId,
    resource,
    submit,
  };
}
