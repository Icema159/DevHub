import { useCallback, useEffect, useRef, useState } from 'react';

import { normalizeApiError } from '../../lib/api-client';
import { listConversations } from './conversations.service';
import type { ConversationListResource } from './conversations.types';

type LoadMode = 'initial' | 'refresh';

interface ConversationListState {
  page: number;
  resource: ConversationListResource;
}

export interface UseConversationsOptions {
  limit?: number;
  onPageOutOfRange?: (page: number) => void;
  page: number;
  revision?: number;
}

function loadingResource(): ConversationListResource {
  return {
    data: null,
    error: null,
    isRefreshing: false,
    status: 'loading',
  };
}

export function useConversations({
  limit = 20,
  onPageOutOfRange,
  page,
  revision = 0,
}: UseConversationsOptions) {
  const [state, setState] = useState<ConversationListState>({
    page,
    resource: loadingResource(),
  });
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const requestPromiseRef = useRef<Promise<void> | null>(null);
  const revisionRef = useRef(revision);
  const stateRef = useRef(state);

  const commit = useCallback((nextState: ConversationListState) => {
    stateRef.current = nextState;

    if (mountedRef.current) {
      setState(nextState);
    }
  }, []);

  const loadPage = useCallback(
    (nextPage: number, mode: LoadMode, force = false): Promise<void> => {
      if (controllerRef.current) {
        if (mode === 'refresh' && !force) {
          return requestPromiseRef.current ?? Promise.resolve();
        }

        controllerRef.current.abort();
      }

      const previousState = stateRef.current;
      const preservedData =
        previousState.page === nextPage && previousState.resource.status === 'success'
          ? previousState.resource.data
          : null;
      const controller = new AbortController();
      const requestId = requestIdRef.current + 1;

      controllerRef.current = controller;
      requestIdRef.current = requestId;

      if (mode === 'refresh' && preservedData) {
        commit({
          page: nextPage,
          resource: {
            data: preservedData,
            error: null,
            isRefreshing: true,
            refreshError: null,
            status: 'success',
          },
        });
      } else {
        commit({ page: nextPage, resource: loadingResource() });
      }

      const request = (async () => {
        try {
          const data = await listConversations(
            { page: nextPage, limit },
            { signal: controller.signal },
          );

          if (
            controller.signal.aborted ||
            !mountedRef.current ||
            requestIdRef.current !== requestId
          ) {
            return;
          }

          const lastAvailablePage = Math.max(data.meta.totalPages, 1);

          if (nextPage > lastAvailablePage) {
            onPageOutOfRange?.(lastAvailablePage);
            return;
          }

          commit({
            page: nextPage,
            resource: {
              data,
              error: null,
              isRefreshing: false,
              refreshError: null,
              status: 'success',
            },
          });
        } catch (error) {
          if (
            controller.signal.aborted ||
            !mountedRef.current ||
            requestIdRef.current !== requestId
          ) {
            return;
          }

          const normalizedError = normalizeApiError(error);

          if (mode === 'refresh' && preservedData) {
            commit({
              page: nextPage,
              resource: {
                data: preservedData,
                error: null,
                isRefreshing: false,
                refreshError: normalizedError,
                status: 'success',
              },
            });
            return;
          }

          commit({
            page: nextPage,
            resource: {
              data: null,
              error: normalizedError,
              isRefreshing: false,
              status: 'error',
            },
          });
        } finally {
          if (controllerRef.current === controller) {
            controllerRef.current = null;
          }

          if (requestIdRef.current === requestId) {
            requestPromiseRef.current = null;
          }
        }
      })();

      requestPromiseRef.current = request;
      return request;
    },
    [commit, limit, onPageOutOfRange],
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const revisionChanged = revisionRef.current !== revision;
    const currentState = stateRef.current;
    const mode: LoadMode =
      currentState.page === page && currentState.resource.status === 'success'
        ? 'refresh'
        : 'initial';

    revisionRef.current = revision;
    void loadPage(page, mode, revisionChanged);

    return () => {
      controllerRef.current?.abort();
    };
  }, [loadPage, page, revision]);

  const refresh = useCallback(
    () => loadPage(page, stateRef.current.resource.status === 'success' ? 'refresh' : 'initial'),
    [loadPage, page],
  );

  const resource = state.page === page ? state.resource : loadingResource();

  return {
    refresh,
    resource,
  };
}
