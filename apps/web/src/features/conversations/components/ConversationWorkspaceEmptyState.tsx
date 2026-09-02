import { MessageSquareText } from 'lucide-react';

import { EmptyState } from '../../../components/ui';

export function ConversationWorkspaceEmptyState({
  useThreadTerminology = false,
}: {
  useThreadTerminology?: boolean;
}) {
  return (
    <EmptyState
      className="chat-empty-state chat-v4-empty-card m-auto w-full max-w-xl border-0 bg-transparent shadow-none"
      description={
        useThreadTerminology
          ? 'Choose a thread from the list, or create a new one.'
          : 'Choose a conversation from the list, or create a new one.'
      }
      icon={<MessageSquareText className="size-6" aria-hidden="true" />}
      title={useThreadTerminology ? 'Select a thread' : 'Select a conversation'}
    />
  );
}
