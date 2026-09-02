import { MessagesSquare, Plus, RefreshCw } from 'lucide-react';

import { Alert, Button, EmptyState, Pagination } from '../../../components/ui';
import type { ConversationListResource } from '../conversations.types';
import { ConversationListItem } from './ConversationListItem';
import { ConversationListSkeleton } from './ConversationListSkeleton';

export interface ConversationListProps {
  createError: string | null;
  isCreating: boolean;
  onCreate: () => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  page: number;
  resource: ConversationListResource;
  routeBasePath: string;
  selectedConversationId?: string;
  useThreadTerminology?: boolean;
}

export function ConversationList({
  createError,
  isCreating,
  onCreate,
  onPageChange,
  onRetry,
  page,
  resource,
  routeBasePath,
  selectedConversationId,
  useThreadTerminology = false,
}: ConversationListProps) {
  const showFooter =
    resource.status === 'success' &&
    (!useThreadTerminology ||
      resource.refreshError !== null ||
      resource.data.meta.totalPages > 1 ||
      resource.isRefreshing);

  return (
    <section
      className="material-workspace chat-conversation-rail elevation-1 flex h-full min-h-[36rem] min-w-0 flex-col overflow-hidden rounded-glass border"
      {...(useThreadTerminology
        ? { 'aria-label': 'Threads' }
        : { 'aria-labelledby': 'conversations-heading' })}
      aria-busy={resource.status === 'loading' || undefined}
    >
      <div className="relative z-10 border-b border-border/70 bg-white/28 p-4 supports-[backdrop-filter]:backdrop-blur-sm sm:p-5">
        {!useThreadTerminology ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                className="type-heading-2 font-semibold tracking-tight text-foreground"
                id="conversations-heading"
              >
                Conversations
              </h2>
              <p className="mt-1 type-small text-muted">Your recent knowledge conversations.</p>
            </div>
          </div>
        ) : null}

        <Button
          className={
            useThreadTerminology ? 'chat-primary-cta w-full' : 'chat-primary-cta mt-4 w-full'
          }
          isLoading={isCreating}
          loadingLabel="Creating…"
          onClick={onCreate}
          size="small"
        >
          <Plus className="size-4" aria-hidden="true" />
          {useThreadTerminology ? 'New thread' : 'New conversation'}
        </Button>

        {createError ? (
          <Alert
            className="mt-3"
            title={
              useThreadTerminology
                ? 'Thread could not be created'
                : 'Conversation could not be created'
            }
            variant="error"
          >
            {createError}
          </Alert>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        {resource.status === 'loading' ? <ConversationListSkeleton /> : null}

        {resource.status === 'error' ? (
          <div className="p-4">
            <Alert
              title={
                useThreadTerminology
                  ? 'Threads could not be loaded'
                  : 'Conversations could not be loaded'
              }
              variant="error"
            >
              <p>{resource.error.message}</p>
              <Button className="mt-4" onClick={onRetry} size="small" variant="secondary">
                <RefreshCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </Alert>
          </div>
        ) : null}

        {resource.status === 'success' && resource.data.conversations.length === 0 ? (
          <EmptyState
            className="chat-empty-state chat-v4-empty-card m-4 py-8"
            description={
              useThreadTerminology
                ? 'Create a thread to start building your knowledge workspace.'
                : 'Create a conversation to start building your knowledge workspace.'
            }
            icon={<MessagesSquare className="size-6" aria-hidden="true" />}
            title={useThreadTerminology ? 'No threads yet' : 'No conversations yet'}
          />
        ) : null}

        {resource.status === 'success' && resource.data.conversations.length > 0 ? (
          <nav
            className="p-2 sm:p-3"
            aria-label={useThreadTerminology ? 'Threads' : 'Conversations'}
          >
            <ul className="grid gap-0.5">
              {resource.data.conversations.map((conversation) => (
                <ConversationListItem
                  conversation={conversation}
                  key={conversation.id}
                  page={page}
                  routeBasePath={routeBasePath}
                  selected={conversation.id === selectedConversationId}
                  useThreadTerminology={useThreadTerminology}
                />
              ))}
            </ul>
          </nav>
        ) : null}
      </div>

      {showFooter && resource.status === 'success' ? (
        <div className="relative z-10 border-t border-border/70 bg-white/24 p-3 supports-[backdrop-filter]:backdrop-blur-sm">
          {resource.refreshError ? (
            <Alert
              className="mb-3"
              title={
                useThreadTerminology
                  ? 'Could not refresh threads'
                  : 'Could not refresh conversations'
              }
              variant="error"
            >
              {resource.refreshError.message}
            </Alert>
          ) : null}
          {resource.data.meta.totalPages > 1 ? (
            <Pagination
              currentPage={resource.data.meta.page}
              onPageChange={onPageChange}
              totalPages={resource.data.meta.totalPages}
            />
          ) : !useThreadTerminology ? (
            <p className="text-center type-caption text-muted">
              {resource.data.meta.total === 1
                ? '1 conversation'
                : `${resource.data.meta.total} conversations`}
            </p>
          ) : null}
          {resource.isRefreshing ? (
            <p className="sr-only" role="status">
              {useThreadTerminology ? 'Refreshing threads' : 'Refreshing conversations'}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
