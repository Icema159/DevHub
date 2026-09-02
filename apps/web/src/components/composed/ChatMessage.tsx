import { Copy, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';
import { Card, IconButton } from '../ui';
import { AssistantAnswerWithSources } from './AssistantAnswerWithSources';
import { CitationSource, type CitationSourceProps } from './CitationSource';

export type ChatMessageRole = 'user' | 'assistant';

export interface ChatCitation extends Pick<
  CitationSourceProps,
  'filename' | 'page' | 'sourceLabel'
> {
  documentId: string;
}

export interface ChatMessageProps {
  children: ReactNode;
  citations?: ChatCitation[];
  content?: string;
  enableCitationInteraction?: boolean;
  hideAssistantAvatar?: boolean;
  onCopy?: () => void;
  role: ChatMessageRole;
}

export function ChatMessage({
  children,
  citations = [],
  content,
  enableCitationInteraction = false,
  hideAssistantAvatar,
  onCopy,
  role,
}: ChatMessageProps) {
  const shouldHideAssistantAvatar = hideAssistantAvatar ?? enableCitationInteraction;

  if (role === 'user') {
    return (
      <article className="chat-message-user flex justify-end" aria-label="User message">
        <div className="chat-message-user-surface max-w-[88%] rounded-[1.25rem] rounded-br-md border border-primary/10 bg-primary-soft/75 px-4 py-3 type-body text-foreground shadow-glass-low sm:max-w-[72%]">
          <span className="sr-only">User: </span>
          {content === undefined ? (
            children
          ) : (
            <>
              <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{content}</p>
              {children}
            </>
          )}
        </div>
      </article>
    );
  }

  return (
    <article
      className="chat-message-assistant flex items-start gap-3"
      aria-label="Assistant message"
    >
      {!shouldHideAssistantAvatar ? (
        <span className="chat-message-assistant-avatar mt-1 flex size-10 shrink-0 items-center justify-center rounded-card border border-white/80 bg-white/76 text-primary shadow-glass-low supports-[backdrop-filter]:backdrop-blur-sm">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
      ) : null}
      <Card
        className="chat-message-assistant-surface min-w-0 flex-1 p-5 shadow-glass-low sm:p-6"
        variant="solid"
      >
        {enableCitationInteraction && content !== undefined && citations.length > 0 ? (
          <AssistantAnswerWithSources citations={citations} content={content} footer={children} />
        ) : (
          <div className="type-body leading-6 text-foreground">
            <span className="sr-only">Assistant: </span>
            {content === undefined ? (
              children
            ) : (
              <>
                <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                  {content}
                </p>
                {children}
              </>
            )}
          </div>
        )}
        {!enableCitationInteraction && citations.length > 0 ? (
          <div className="chat-message-sources mt-5 border-t border-border/80 pt-4">
            <p className="type-small font-semibold text-foreground">Sources used</p>
            <div className="chat-source-list mt-2 grid gap-2 rounded-card border border-border/70 bg-slate-50/60 p-2">
              {citations.map((citation, index) => (
                <CitationSource
                  key={`${citation.documentId}-${citation.sourceLabel}-${index}`}
                  to={`/documents/${encodeURIComponent(citation.documentId)}`}
                  filename={citation.filename}
                  sourceLabel={citation.sourceLabel}
                  {...(citation.page === undefined ? {} : { page: citation.page })}
                />
              ))}
            </div>
          </div>
        ) : null}
        {onCopy ? (
          <div className={cn('mt-3 flex', citations.length > 0 && 'mt-4')}>
            <IconButton
              className="size-9 border-transparent bg-transparent shadow-none"
              label="Copy answer"
              onClick={onCopy}
            >
              <Copy className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        ) : null}
      </Card>
    </article>
  );
}
