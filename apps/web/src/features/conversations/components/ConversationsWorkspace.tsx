import { cn } from '../../../lib/cn';
import type {
  ConversationListResource,
  SelectedConversationResource,
} from '../conversations.types';
import type {
  MessageSubmissionOutcome,
  MessageSubmissionResource,
} from '../use-conversation-messaging';
import { ConversationList } from './ConversationList';
import { ConversationWorkspaceEmptyState } from './ConversationWorkspaceEmptyState';
import { SelectedConversationShell } from './SelectedConversationShell';

export interface ConversationsWorkspaceProps {
  createError: string | null;
  enableCitationInteraction?: boolean;
  isCreating: boolean;
  isMessageBusy: boolean;
  isSubmittingMessage: boolean;
  listPage: number;
  listResource: ConversationListResource;
  onCreate: () => void;
  onListPageChange: (page: number) => void;
  onListRetry: () => void;
  onSelectedRetry: () => void;
  onSendMessage: (content: string) => Promise<MessageSubmissionOutcome>;
  routeBasePath: string;
  selectedConversationId?: string;
  selectedResource: SelectedConversationResource;
  submissionResource: MessageSubmissionResource;
  useThreadTerminology?: boolean;
}

export function ConversationsWorkspace({
  createError,
  enableCitationInteraction = false,
  isCreating,
  isMessageBusy,
  isSubmittingMessage,
  listPage,
  listResource,
  onCreate,
  onListPageChange,
  onListRetry,
  onSelectedRetry,
  onSendMessage,
  routeBasePath,
  selectedConversationId,
  selectedResource,
  submissionResource,
  useThreadTerminology = false,
}: ConversationsWorkspaceProps) {
  return (
    <div className="chat-workspace-composition grid min-w-0 gap-5 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] xl:items-stretch">
      <div
        className={cn(
          'mx-auto h-[calc(100svh-7rem)] min-h-[36rem] w-full max-w-xl min-w-0 sm:h-[calc(100svh-8rem)] lg:h-[calc(100svh-5rem)] xl:mx-0 xl:max-w-none',
          selectedConversationId && 'hidden xl:block',
        )}
      >
        <ConversationList
          createError={createError}
          isCreating={isCreating}
          onCreate={onCreate}
          onPageChange={onListPageChange}
          onRetry={onListRetry}
          page={listPage}
          resource={listResource}
          routeBasePath={routeBasePath}
          useThreadTerminology={useThreadTerminology}
          {...(selectedConversationId ? { selectedConversationId } : {})}
        />
      </div>

      <section
        className={cn(
          'material-workspace chat-workspace-shell elevation-1 h-[calc(100svh-7rem)] min-h-[36rem] min-w-0 overflow-hidden rounded-glass border sm:h-[calc(100svh-8rem)] lg:h-[calc(100svh-5rem)]',
          !selectedConversationId && 'hidden xl:flex',
        )}
        aria-label={useThreadTerminology ? 'Thread workspace' : 'Conversation workspace'}
      >
        {selectedConversationId ? (
          <SelectedConversationShell
            enableCitationInteraction={enableCitationInteraction}
            isMessageBusy={isMessageBusy}
            isSubmittingMessage={isSubmittingMessage}
            listPage={listPage}
            onRetry={onSelectedRetry}
            onSendMessage={onSendMessage}
            resource={selectedResource}
            routeBasePath={routeBasePath}
            submissionResource={submissionResource}
            useThreadTerminology={useThreadTerminology}
          />
        ) : (
          <ConversationWorkspaceEmptyState useThreadTerminology={useThreadTerminology} />
        )}
      </section>
    </div>
  );
}
