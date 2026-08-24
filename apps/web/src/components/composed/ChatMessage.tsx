import { Copy, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';
import { Card, IconButton } from '../ui';
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
  onCopy?: () => void;
  role: ChatMessageRole;
}

export function ChatMessage({ children, citations = [], onCopy, role }: ChatMessageProps) {
  if (role === 'user') {
    return (
      <article className="flex justify-end" aria-label="User message">
        <div className="max-w-[88%] rounded-[1.25rem] rounded-br-md border border-primary/10 bg-primary-soft/75 px-4 py-3 type-body text-foreground shadow-glass-low sm:max-w-[72%]">
          <span className="sr-only">User: </span>
          {children}
        </div>
      </article>
    );
  }

  return (
    <article className="flex items-start gap-3" aria-label="Assistant message">
      <span className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-card border border-white/80 bg-white/76 text-primary shadow-glass-low supports-[backdrop-filter]:backdrop-blur-sm">
        <Sparkles className="size-5" aria-hidden="true" />
      </span>
      <Card className="min-w-0 flex-1 p-5 shadow-glass-low sm:p-6" variant="solid">
        <div className="type-body leading-6 text-foreground">
          <span className="sr-only">Assistant: </span>
          {children}
        </div>
        {citations.length > 0 ? (
          <div className="mt-5 border-t border-border/80 pt-4">
            <p className="type-small font-semibold text-foreground">Sources used</p>
            <div className="mt-2 grid gap-2 rounded-card border border-border/70 bg-slate-50/60 p-2">
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
