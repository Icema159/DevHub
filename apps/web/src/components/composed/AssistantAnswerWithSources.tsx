import { useId, useMemo, useRef, useState, type ReactNode } from 'react';

import { cn } from '../../lib/cn';
import { CitationSource } from './CitationSource';
import type { ChatCitation } from './ChatMessage';

export interface AssistantAnswerWithSourcesProps {
  citations: ChatCitation[];
  content: string;
  footer?: ReactNode;
}

const CITATION_TOKEN_PATTERN = /(\[S[1-9]\d*\])/g;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function sourceName(sourceLabel: string): string {
  return sourceLabel.slice(1, -1);
}

function safeIdSegment(sourceLabel: string): string {
  return sourceLabel.replaceAll(/[^A-Za-z0-9_-]/g, '');
}

export function AssistantAnswerWithSources({
  citations,
  content,
  footer,
}: AssistantAnswerWithSourcesProps) {
  const reactId = useId();
  const idPrefix = `assistant-source-${reactId.replaceAll(':', '')}`;
  const [activeSourceLabel, setActiveSourceLabel] = useState<string | null>(null);
  const sourceRefs = useRef(new Map<string, HTMLAnchorElement>());
  const validSourceLabels = useMemo(
    () => new Set(citations.map((citation) => citation.sourceLabel)),
    [citations],
  );
  const contentParts = useMemo(() => content.split(CITATION_TOKEN_PATTERN), [content]);

  const sourceId = (sourceLabel: string) => `${idPrefix}-${safeIdSegment(sourceLabel)}`;

  const focusSource = (sourceLabel: string) => {
    const source = sourceRefs.current.get(sourceLabel);

    if (!source) {
      return;
    }

    setActiveSourceLabel(sourceLabel);
    source.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'nearest',
    });
    source.focus({ preventScroll: true });
  };

  return (
    <>
      <div className="type-body leading-6 text-foreground">
        <span className="sr-only">Assistant: </span>
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          {contentParts.map((part, index) => {
            if (!validSourceLabels.has(part)) {
              return <span key={`${index}-${part}`}>{part}</span>;
            }

            const isActive = activeSourceLabel === part;

            return (
              <button
                key={`${index}-${part}`}
                type="button"
                className={cn('chat-inline-citation', isActive && 'is-active')}
                aria-controls={sourceId(part)}
                aria-label={`Show source ${sourceName(part)}`}
                data-source-label={part}
                onBlur={() => setActiveSourceLabel(null)}
                onClick={() => focusSource(part)}
                onFocus={() => setActiveSourceLabel(part)}
                onMouseEnter={() => setActiveSourceLabel(part)}
                onMouseLeave={() => setActiveSourceLabel(null)}
              >
                {part}
              </button>
            );
          })}
        </p>
        {footer}
      </div>

      <div className="chat-message-sources mt-5 border-t border-border/80 pt-4">
        <p className="type-small font-semibold text-foreground">Sources used</p>
        <div className="chat-source-list chat-source-receipts mt-2 grid">
          {citations.map((citation, index) => {
            const isActive = activeSourceLabel === citation.sourceLabel;

            return (
              <CitationSource
                ref={(node) => {
                  if (node) {
                    sourceRefs.current.set(citation.sourceLabel, node);
                  } else {
                    sourceRefs.current.delete(citation.sourceLabel);
                  }
                }}
                key={`${citation.documentId}-${citation.sourceLabel}-${index}`}
                id={sourceId(citation.sourceLabel)}
                className={cn('chat-citation-receipt', isActive && 'is-active')}
                data-source-label={citation.sourceLabel}
                to={`/documents/${encodeURIComponent(citation.documentId)}`}
                filename={citation.filename}
                isActive={isActive}
                sourceLabel={citation.sourceLabel}
                onBlur={() => setActiveSourceLabel(null)}
                onFocus={() => setActiveSourceLabel(citation.sourceLabel)}
                onMouseEnter={() => setActiveSourceLabel(citation.sourceLabel)}
                onMouseLeave={() => setActiveSourceLabel(null)}
                {...(citation.page === undefined ? {} : { page: citation.page })}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}
