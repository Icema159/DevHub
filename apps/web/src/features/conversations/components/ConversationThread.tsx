import { useEffect, useRef } from 'react';
import { MessageSquareText } from 'lucide-react';

import { ChatMessage, type ChatCitation } from '../../../components/composed';
import { EmptyState } from '../../../components/ui';
import { formatAbsoluteDate } from '../../../lib/date-format';
import type { PublicConversationMessage } from '../conversations.types';

export interface ConversationThreadProps {
  enableCitationInteraction?: boolean;
  hideAssistantAvatar?: boolean;
  isSubmitting: boolean;
  messages: PublicConversationMessage[];
  pendingContent?: string;
  streamedAnswer?: string;
  streamingPhase?: 'starting' | 'retrieving' | 'generating';
}

const NEAR_BOTTOM_DISTANCE = 120;

function displaySourceLabel(label: string): string {
  return `[${label}]`;
}

function assistantCitations(message: PublicConversationMessage): ChatCitation[] {
  if (message.role !== 'ASSISTANT') {
    return [];
  }

  return message.sources.map((source) => ({
    documentId: source.documentId,
    filename: source.documentName,
    sourceLabel: displaySourceLabel(source.label),
    ...(source.page === null ? {} : { page: source.page }),
  }));
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function ConversationThread({
  enableCitationInteraction = false,
  hideAssistantAvatar = false,
  isSubmitting,
  messages,
  pendingContent,
  streamedAnswer = '',
  streamingPhase,
}: ConversationThreadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const previousMessageCountRef = useRef(0);
  const previousStreamLengthRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const isInitialLoad = previousMessageCountRef.current === 0;
    const hasNewMessage = messages.length > previousMessageCountRef.current;
    const hasStreamProgress = streamedAnswer.length > previousStreamLengthRef.current;
    previousMessageCountRef.current = messages.length;
    previousStreamLengthRef.current = streamedAnswer.length;

    if (
      !isInitialLoad &&
      (!nearBottomRef.current || (!hasNewMessage && !hasStreamProgress && !isSubmitting))
    ) {
      return;
    }

    const top = container.scrollHeight;

    if (typeof container.scrollTo === 'function') {
      container.scrollTo({
        behavior: hasStreamProgress || prefersReducedMotion() ? 'auto' : 'smooth',
        top,
      });
    } else {
      container.scrollTop = top;
    }
  }, [isSubmitting, messages.length, streamedAnswer.length]);

  const hasTransientTurn = isSubmitting && pendingContent !== undefined;
  const streamingStatus =
    streamingPhase === 'generating' ? 'Generating answer…' : 'Retrieving relevant sources…';

  return (
    <div
      ref={containerRef}
      className="chat-message-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-7 lg:px-8"
      onScroll={(event) => {
        const container = event.currentTarget;
        nearBottomRef.current =
          container.scrollHeight - container.scrollTop - container.clientHeight <=
          NEAR_BOTTOM_DISTANCE;
      }}
      aria-label="Conversation messages"
    >
      {messages.length === 0 && !hasTransientTurn ? (
        <EmptyState
          className="chat-empty-state mx-auto my-8 w-full max-w-xl border-0 bg-transparent"
          description="Ask a question about the knowledge available in your workspace."
          icon={<MessageSquareText className="size-6" aria-hidden="true" />}
          title="Start the conversation"
        />
      ) : (
        <ol className="mx-auto grid w-full max-w-4xl gap-5 sm:gap-6" aria-label="Messages">
          {messages.map((message) => {
            const absoluteDate = formatAbsoluteDate(message.createdAt);

            return (
              <li key={message.id} className="min-w-0">
                <ChatMessage
                  citations={assistantCitations(message)}
                  content={message.content}
                  enableCitationInteraction={
                    enableCitationInteraction && message.role === 'ASSISTANT'
                  }
                  hideAssistantAvatar={hideAssistantAvatar && message.role === 'ASSISTANT'}
                  role={message.role === 'USER' ? 'user' : 'assistant'}
                >
                  <time
                    className="mt-2 block type-caption text-muted"
                    dateTime={message.createdAt}
                    aria-label={`${message.role === 'USER' ? 'Sent' : 'Answered'} ${absoluteDate}`}
                    title={absoluteDate}
                  >
                    {absoluteDate}
                  </time>
                </ChatMessage>
              </li>
            );
          })}
          {hasTransientTurn ? (
            <>
              <li className="min-w-0" data-testid="pending-user-message">
                <ChatMessage content={pendingContent} role="user">
                  <span className="sr-only">Sending</span>
                </ChatMessage>
              </li>
              <li className="min-w-0" data-testid="streaming-assistant-message">
                <ChatMessage
                  hideAssistantAvatar={hideAssistantAvatar}
                  role="assistant"
                  {...(streamedAnswer ? { content: streamedAnswer } : {})}
                >
                  {streamedAnswer ? (
                    <span className="sr-only" role="status">
                      Answer is still being generated.
                    </span>
                  ) : (
                    <p className="type-small text-muted" role="status">
                      {streamingStatus}
                    </p>
                  )}
                </ChatMessage>
              </li>
            </>
          ) : null}
        </ol>
      )}
    </div>
  );
}
