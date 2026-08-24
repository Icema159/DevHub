import { useCallback, useEffect, useRef, useState } from 'react';

import { normalizeApiError } from '../../lib/api-client';
import { getConversation, isValidConversationId } from './conversations.service';
import type {
  SelectedConversationRefreshResult,
  SelectedConversationResource,
} from './conversations.types';

interface SelectedConversationState {
  conversationId: string;
  resource: SelectedConversationResource;
}

function loadingResource(): SelectedConversationResource {
  return {
    data: null,
    error: null,
    status: 'loading',
  };
}

function notFoundResource(): SelectedConversationResource {
  return {
    data: null,
    error: null,
    status: 'not-found',
  };
}

export function useSelectedConversation(conversationId: string | undefined) {
  const routeConversationId = conversationId ?? '';
  const validConversationId = isValidConversationId(routeConversationId);
  const [state, setState] = useState<SelectedConversationState>({
    conversationId: routeConversationId,
    resource: validConversationId ? loadingResource() : notFoundResource(),
  });
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const requestPromiseRef = useRef<Promise<SelectedConversationRefreshResult> | null>(null);
  const requestConversationIdRef = useRef<string | null>(null);
  const stateRef = useRef(state);

  const commit = useCallback((nextState: SelectedConversationState) => {
    stateRef.current = nextState;

    if (mountedRef.current) {
      setState(nextState);
    }
  }, []);

  const loadConversation = useCallback(
    (
      nextConversationId: string,
      options: { force?: boolean; preserveData?: boolean } = {},
    ): Promise<SelectedConversationRefreshResult> => {
      if (
        requestPromiseRef.current &&
        requestConversationIdRef.current === nextConversationId &&
        controllerRef.current &&
        !controllerRef.current.signal.aborted &&
        !options.force
      ) {
        return requestPromiseRef.current;
      }

      if (controllerRef.current) {
        controllerRef.current.abort();
      }

      const controller = new AbortController();
      const requestId = requestIdRef.current + 1;

      controllerRef.current = controller;
      requestIdRef.current = requestId;
      requestConversationIdRef.current = nextConversationId;
      const previousState = stateRef.current;
      const canPreserveData =
        options.preserveData === true &&
        previousState.conversationId === nextConversationId &&
        previousState.resource.status === 'success';

      if (!canPreserveData) {
        commit({ conversationId: nextConversationId, resource: loadingResource() });
      }

      const request = (async () => {
        try {
          const data = await getConversation(nextConversationId, {
            signal: controller.signal,
          });

          if (
            controller.signal.aborted ||
            !mountedRef.current ||
            requestIdRef.current !== requestId
          ) {
            return { status: 'cancelled' } as const;
          }

          commit({
            conversationId: nextConversationId,
            resource: {
              data,
              error: null,
              status: 'success',
            },
          });
          return { data, status: 'success' } as const;
        } catch (error) {
          if (
            controller.signal.aborted ||
            !mountedRef.current ||
            requestIdRef.current !== requestId
          ) {
            return { status: 'cancelled' } as const;
          }

          const normalizedError = normalizeApiError(error);

          if (normalizedError.code === 'CONVERSATION_NOT_FOUND') {
            commit({ conversationId: nextConversationId, resource: notFoundResource() });
            return { status: 'not-found' } as const;
          }

          if (!canPreserveData) {
            commit({
              conversationId: nextConversationId,
              resource: {
                data: null,
                error: normalizedError,
                status: 'error',
              },
            });
          }

          return { error: normalizedError, status: 'error' } as const;
        } finally {
          if (controllerRef.current === controller) {
            controllerRef.current = null;
          }

          if (requestIdRef.current === requestId) {
            requestPromiseRef.current = null;
            requestConversationIdRef.current = null;
          }
        }
      })();

      requestPromiseRef.current = request;
      return request;
    },
    [commit],
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!validConversationId) {
      controllerRef.current?.abort();
      requestIdRef.current += 1;
      commit({
        conversationId: routeConversationId,
        resource: notFoundResource(),
      });
      return;
    }

    void loadConversation(routeConversationId);

    return () => {
      controllerRef.current?.abort();
    };
  }, [commit, loadConversation, routeConversationId, validConversationId]);

  const refresh = useCallback(() => {
    if (!validConversationId) {
      return Promise.resolve({ status: 'not-found' } as const);
    }

    if (requestPromiseRef.current) {
      return requestPromiseRef.current;
    }

    return loadConversation(routeConversationId);
  }, [loadConversation, routeConversationId, validConversationId]);

  const refreshAuthoritative = useCallback(() => {
    if (!validConversationId) {
      return Promise.resolve({ status: 'not-found' } as const);
    }

    return loadConversation(routeConversationId, {
      force: true,
      preserveData: true,
    });
  }, [loadConversation, routeConversationId, validConversationId]);

  const resource =
    state.conversationId === routeConversationId
      ? state.resource
      : validConversationId
        ? loadingResource()
        : notFoundResource();

  return {
    refresh,
    refreshAuthoritative,
    resource,
  };
}
