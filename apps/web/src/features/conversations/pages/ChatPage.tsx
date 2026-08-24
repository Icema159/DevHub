import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { usePageTitle } from '../../../lib/page-title';
import { conversationDisplayTitle } from '../conversation-display';
import { ConversationsWorkspace } from '../components';
import type { PublicConversation } from '../conversations.types';
import { useConversations } from '../use-conversations';
import { useConversationMessaging } from '../use-conversation-messaging';
import { useCreateConversation } from '../use-create-conversation';
import { useSelectedConversation } from '../use-selected-conversation';

const CONVERSATIONS_PAGE_SIZE = 20;

function pageFromSearch(value: string | null): number {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    return 1;
  }

  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

export function ChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [listRevision, setListRevision] = useState(0);
  const page = pageFromSearch(searchParams.get('page'));

  const setPage = useCallback(
    (nextPage: number) => {
      if (!Number.isInteger(nextPage) || nextPage < 1) {
        return;
      }

      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('page', String(nextPage));
      setSearchParams(nextParams);
    },
    [searchParams, setSearchParams],
  );

  const handlePageOutOfRange = useCallback(
    (lastPage: number) => {
      setPage(lastPage);
    },
    [setPage],
  );
  const conversations = useConversations({
    limit: CONVERSATIONS_PAGE_SIZE,
    onPageOutOfRange: handlePageOutOfRange,
    page,
    revision: listRevision,
  });
  const selectedConversation = useSelectedConversation(conversationId);
  const handleConversationActivity = useCallback(() => {
    if (page !== 1) {
      setPage(1);
    }

    setListRevision((current) => current + 1);
  }, [page, setPage]);
  const selectedMessages =
    selectedConversation.resource.status === 'success'
      ? selectedConversation.resource.data.messages
      : [];
  const messaging = useConversationMessaging({
    conversationId,
    messages: selectedMessages,
    onConversationActivity: handleConversationActivity,
    refreshConversation: selectedConversation.refreshAuthoritative,
  });
  const handleCreated = useCallback(
    (conversation: PublicConversation) => {
      setListRevision((current) => current + 1);
      navigate(`/chat/${encodeURIComponent(conversation.id)}?page=1`);
    },
    [navigate],
  );
  const creation = useCreateConversation({ onCreated: handleCreated });
  const selectedTitle = useMemo(() => {
    if (selectedConversation.resource.status !== 'success') {
      return 'Chat';
    }

    return conversationDisplayTitle(selectedConversation.resource.data.title);
  }, [selectedConversation.resource]);

  usePageTitle(selectedTitle);

  return (
    <div className="min-w-0">
      <h1 className="sr-only">Chat</h1>

      <ConversationsWorkspace
        createError={creation.resource.status === 'error' ? creation.resource.error.message : null}
        isCreating={creation.isCreating}
        isMessageBusy={messaging.isBusy}
        isSubmittingMessage={messaging.isSubmittingCurrent}
        listPage={page}
        listResource={conversations.resource}
        onCreate={() => {
          void creation.create().catch(() => undefined);
        }}
        onListPageChange={setPage}
        onListRetry={() => void conversations.refresh()}
        onSelectedRetry={() => void selectedConversation.refresh()}
        onSendMessage={messaging.submit}
        selectedResource={selectedConversation.resource}
        submissionResource={messaging.resource}
        {...(conversationId ? { selectedConversationId: conversationId } : {})}
      />
    </div>
  );
}
