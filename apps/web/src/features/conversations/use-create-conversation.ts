import { useCallback, useEffect, useRef, useState } from 'react';

import { normalizeApiError } from '../../lib/api-client';
import { createConversation } from './conversations.service';
import type { CreateConversationResource, PublicConversation } from './conversations.types';

export interface UseCreateConversationOptions {
  onCreated: (conversation: PublicConversation) => void;
}

const idleResource: CreateConversationResource = {
  error: null,
  status: 'idle',
};

export function useCreateConversation({ onCreated }: UseCreateConversationOptions) {
  const [resource, setResource] = useState<CreateConversationResource>(idleResource);
  const mountedRef = useRef(true);
  const requestPromiseRef = useRef<Promise<PublicConversation> | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const create = useCallback((): Promise<PublicConversation> => {
    if (requestPromiseRef.current) {
      return requestPromiseRef.current;
    }

    if (mountedRef.current) {
      setResource({ error: null, status: 'creating' });
    }

    const request = createConversation()
      .then((conversation) => {
        if (mountedRef.current) {
          setResource({ error: null, status: 'success' });
          onCreated(conversation);
        }

        return conversation;
      })
      .catch((error: unknown) => {
        const normalizedError = normalizeApiError(error);

        if (mountedRef.current) {
          setResource({ error: normalizedError, status: 'error' });
        }

        throw normalizedError;
      })
      .finally(() => {
        requestPromiseRef.current = null;
      });

    requestPromiseRef.current = request;
    return request;
  }, [onCreated]);

  return {
    create,
    isCreating: resource.status === 'creating',
    resource,
  };
}
