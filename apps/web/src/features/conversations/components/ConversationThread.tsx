import { useEffect, useRef } from 'react';
import { MessageSquareText } from 'lucide-react';

import { ChatMessage, type ChatCitation } from '../../../components/composed';
import { EmptyState } from '../../../components/ui';
import { formatAbsoluteDate } from '../../../lib/date-format';
import type { PublicConversationMessage } from '../conversations.types';

export interface ConversationThreadProps {
  isSubmitting: boolean;
  messages: PublicConversationMessage[];
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

export function ConversationThread({ isSubmitting, messages }: ConversationThreadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const previousMessageCountRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const isInitialLoad = previousMessageCountRef.current === 0;
    const hasNewMessage = messages.length > previousMessageCountRef.current;
    previousMessageCountRef.current = messages.length;

    if (!isInitialLoad && !isSubmitting && (!hasNewMessage || !nearBottomRef.current)) {
      return;
    }

    const top = container.scrollHeight;

    if (typeof container.scrollTo === 'function') {
      container.scrollTo({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        top,
      });
    } else {
      container.scrollTop = top;
    }
  }, [isSubmitting, messages.length]);

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-7 lg:px-8"
      onScroll={(event) => {
        const container = event.currentTarget;
        nearBottomRef.current =
          container.scrollHeight - container.scrollTop - container.clientHeight <=
          NEAR_BOTTOM_DISTANCE;
      }}
      aria-label="Conversation messages"
    >
      {messages.length === 0 ? (
        <EmptyState
          className="mx-auto my-8 w-full max-w-xl border-0 bg-transparent"
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
                  role={message.role === 'USER' ? 'user' : 'assistant'}
                >
                  <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {message.content}
                  </p>
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
        </ol>
      )}
    </div>
  );
}
