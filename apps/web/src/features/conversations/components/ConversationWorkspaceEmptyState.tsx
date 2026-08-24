import { MessageSquareText } from 'lucide-react';

import { EmptyState } from '../../../components/ui';

export function ConversationWorkspaceEmptyState() {
  return (
    <EmptyState
      className="m-auto w-full max-w-xl border-0 bg-transparent shadow-none"
      description="Choose a conversation from the list, or create a new one."
      icon={<MessageSquareText className="size-6" aria-hidden="true" />}
      title="Select a conversation"
    />
  );
}
