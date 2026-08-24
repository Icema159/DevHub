import { MessageCircle } from 'lucide-react';
import { Link } from 'react-router';

import { cn } from '../../../lib/cn';
import { formatAbsoluteDate, formatCompactRelativeDate } from '../../../lib/date-format';
import { conversationDisplayPreview, conversationDisplayTitle } from '../conversation-display';
import type { PublicConversationSummary } from '../conversations.types';

export interface ConversationListItemProps {
  conversation: PublicConversationSummary;
  page: number;
  selected: boolean;
}

export function ConversationListItem({ conversation, page, selected }: ConversationListItemProps) {
  const title = conversationDisplayTitle(conversation.title);
  const preview = conversationDisplayPreview(conversation.preview);
  const absoluteDate = formatAbsoluteDate(conversation.updatedAt);

  return (
    <li>
      <Link
        className={cn(
          'focus-material group grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 overflow-hidden rounded-control border px-3 py-3 transition',
          selected
            ? 'material-selected chat-conversation-selected border-primary/20'
            : 'border-transparent hover:bg-white/55 hover:text-foreground',
        )}
        aria-current={selected ? 'page' : undefined}
        to={`/chat/${encodeURIComponent(conversation.id)}?page=${page}`}
      >
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-control',
            selected
              ? 'border border-white/75 bg-primary text-on-primary shadow-glass-low'
              : 'border border-primary/8 bg-primary-soft/80 text-primary',
          )}
        >
          <MessageCircle className="size-5" aria-hidden="true" />
        </span>

        <span className="min-w-0">
          <span className="block truncate type-body font-semibold text-foreground" title={title}>
            {title}
          </span>
          <span className="mt-0.5 block truncate type-small text-muted" title={preview}>
            {preview}
          </span>
        </span>

        <time
          className="pt-0.5 type-caption whitespace-nowrap text-muted"
          dateTime={conversation.updatedAt}
          aria-label={`Updated ${absoluteDate}`}
          title={absoluteDate}
        >
          {formatCompactRelativeDate(conversation.updatedAt)}
        </time>
      </Link>
    </li>
  );
}
