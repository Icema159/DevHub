import { ArrowLeft, MessageSquareText, RefreshCw } from 'lucide-react';
import { Link } from 'react-router';

import { Alert, Button, EmptyState, Skeleton } from '../../../components/ui';
import { formatAbsoluteDate, formatRelativeDate } from '../../../lib/date-format';
import { conversationDisplayTitle } from '../conversation-display';
import type { SelectedConversationResource } from '../conversations.types';
import type {
  MessageSubmissionOutcome,
  MessageSubmissionResource,
} from '../use-conversation-messaging';
import { ConversationThread } from './ConversationThread';
import { MessageComposer } from './MessageComposer';

export interface SelectedConversationShellProps {
  isMessageBusy: boolean;
  isSubmittingMessage: boolean;
  listPage: number;
  onRetry: () => void;
  onSendMessage: (content: string) => Promise<MessageSubmissionOutcome>;
  resource: SelectedConversationResource;
  submissionResource: MessageSubmissionResource;
}

function BackToConversationsLink({ page }: { page: number }) {
  return (
    <Link
      className="focus-material inline-flex min-h-10 items-center gap-2 rounded-control px-2 type-body font-semibold text-secondary transition hover:bg-white/55 hover:text-foreground xl:hidden"
      to={`/chat?page=${page}`}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Back to conversations
    </Link>
  );
}

export function SelectedConversationShell({
  isMessageBusy,
  isSubmittingMessage,
  listPage,
  onRetry,
  onSendMessage,
  resource,
  submissionResource,
}: SelectedConversationShellProps) {
  if (resource.status === 'loading') {
    return (
      <section className="flex h-full min-h-[36rem] flex-col" aria-label="Loading conversation">
        <div className="border-b border-border/70 bg-white/28 p-5 supports-[backdrop-filter]:backdrop-blur-sm">
          <BackToConversationsLink page={listPage} />
          <Skeleton className="mt-4 max-w-sm" />
          <Skeleton className="mt-3 max-w-48" />
        </div>
        <div className="flex flex-1 items-center p-6">
          <Skeleton className="h-48 w-full rounded-card" variant="card" />
        </div>
      </section>
    );
  }

  if (resource.status === 'not-found') {
    return (
      <section className="flex h-full min-h-[36rem] flex-col p-5">
        <BackToConversationsLink page={listPage} />
        <EmptyState
          className="m-auto w-full max-w-xl"
          description="This conversation could not be found or is no longer available."
          icon={<MessageSquareText className="size-6" aria-hidden="true" />}
          title="Conversation unavailable"
        />
      </section>
    );
  }

  if (resource.status === 'error') {
    return (
      <section className="flex h-full min-h-[36rem] flex-col p-5">
        <BackToConversationsLink page={listPage} />
        <div className="m-auto w-full max-w-xl">
          <Alert title="Conversation could not be loaded" variant="error">
            <p>{resource.error.message}</p>
            <Button className="mt-4" onClick={onRetry} size="small" variant="secondary">
              <RefreshCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          </Alert>
        </div>
      </section>
    );
  }

  const title = conversationDisplayTitle(resource.data.title);
  const absoluteDate = formatAbsoluteDate(resource.data.updatedAt);

  return (
    <section
      className="flex h-full min-h-[36rem] min-w-0 flex-col"
      aria-labelledby="conversation-title"
    >
      <header className="chat-workspace-header relative z-10 border-b border-border/70 bg-white/28 p-5 supports-[backdrop-filter]:backdrop-blur-sm sm:p-6">
        <BackToConversationsLink page={listPage} />
        <h2
          className="mt-3 break-words type-heading-1 font-semibold tracking-tight text-foreground xl:mt-0"
          id="conversation-title"
        >
          {title}
        </h2>
        <time
          className="mt-1 block type-small text-muted"
          dateTime={resource.data.updatedAt}
          title={absoluteDate}
        >
          Updated {formatRelativeDate(resource.data.updatedAt)}
        </time>
      </header>

      <ConversationThread isSubmitting={isSubmittingMessage} messages={resource.data.messages} />
      <MessageComposer
        key={resource.data.id}
        disabled={isMessageBusy && !isSubmittingMessage}
        isSubmitting={isSubmittingMessage}
        onSubmit={onSendMessage}
        resource={submissionResource}
      />

      {submissionResource.status === 'success' ? (
        <p className="sr-only" role="status">
          Answer added to the conversation.
        </p>
      ) : null}
    </section>
  );
}
