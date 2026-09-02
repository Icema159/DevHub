import { MessageCircle, MessagesSquare } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState, ListSkeleton } from '../../../components/ui';
import { formatAbsoluteDate, formatRelativeDate } from '../../../lib/date-format';
import type { DashboardConversationList, DashboardResource } from '../dashboard.types';
import { DashboardSection } from './DashboardSection';
import { DashboardSectionError } from './DashboardSectionError';

export interface RecentConversationsProps {
  onRetry: () => void;
  resource: DashboardResource<DashboardConversationList>;
}

export function RecentConversations({ onRetry, resource }: RecentConversationsProps) {
  return (
    <DashboardSection
      action={
        <Link
          className="focus-material -my-2 inline-flex min-h-10 items-center rounded-control px-2 type-small font-semibold text-primary underline-offset-4 hover:underline"
          to="/chat"
        >
          View all
        </Link>
      }
      className="min-w-0"
      title="Recent threads"
    >
      {resource.status === 'loading' ? <ListSkeleton count={5} /> : null}

      {resource.status === 'error' ? (
        <DashboardSectionError message={resource.error.message} onRetry={onRetry} />
      ) : null}

      {resource.status === 'success' && resource.data.conversations.length === 0 ? (
        <EmptyState
          className="overview-v4-empty-state py-8"
          description="Your latest knowledge threads will appear here."
          icon={<MessagesSquare className="size-6" aria-hidden="true" />}
          title="No threads yet"
        />
      ) : null}

      {resource.status === 'success' && resource.data.conversations.length > 0 ? (
        <ul className="overview-v4-rows divide-y divide-border/80">
          {resource.data.conversations.map((conversation) => {
            const title = conversation.title?.trim() || 'New conversation';

            return (
              <li key={conversation.id} className="min-w-0 py-1">
                <Link
                  className="overview-v4-row overview-v4-row-link grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-control px-2 py-2.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  to={`/chat/${encodeURIComponent(conversation.id)}`}
                >
                  <span className="overview-conversation-icon flex size-9 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary">
                    <MessageCircle className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span
                      className="block truncate type-body font-medium text-foreground"
                      title={title}
                    >
                      {title}
                    </span>
                    {conversation.preview ? (
                      <span
                        className="mt-0.5 block truncate type-small text-muted"
                        title={conversation.preview}
                      >
                        {conversation.preview}
                      </span>
                    ) : null}
                  </span>
                  <time
                    className="whitespace-nowrap pt-0.5 type-caption text-muted"
                    dateTime={conversation.updatedAt}
                    title={formatAbsoluteDate(conversation.updatedAt)}
                  >
                    {formatRelativeDate(conversation.updatedAt)}
                  </time>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </DashboardSection>
  );
}
