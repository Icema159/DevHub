import { useCallback, useEffect, useRef, useState } from 'react';

import { normalizeApiError } from '../../lib/api-client';
import { getDocumentById, isValidDocumentId } from './documents.service';
import type { DocumentDetailsResource, PublicDocumentDetails } from './documents.types';

interface DocumentDetailsState {
  documentId: string;
  resource: DocumentDetailsResource;
}

type LoadMode = 'initial' | 'refresh';

function loadingResource(): DocumentDetailsResource {
  return {
    data: null,
    error: null,
    isRefreshing: false,
    refreshError: null,
    status: 'loading',
  };
}

function notFoundResource(): DocumentDetailsResource {
  return {
    data: null,
    error: null,
    isRefreshing: false,
    refreshError: null,
    status: 'not-found',
  };
}

export function useDocumentDetails(documentId: string | undefined) {
  const routeDocumentId = documentId ?? '';
  const validDocumentId = isValidDocumentId(routeDocumentId);
  const initialState: DocumentDetailsState = {
    documentId: routeDocumentId,
    resource: validDocumentId ? loadingResource() : notFoundResource(),
  };
  const [state, setState] = useState<DocumentDetailsState>(initialState);

  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const requestPromiseRef = useRef<Promise<void> | null>(null);
  const stateRef = useRef(state);

  const commit = useCallback((nextState: DocumentDetailsState) => {
    stateRef.current = nextState;

    if (mountedRef.current) {
      setState(nextState);
    }
  }, []);

  const loadDocument = useCallback(
    (nextDocumentId: string, mode: LoadMode): Promise<void> => {
      if (controllerRef.current) {
        if (mode === 'refresh') {
          return requestPromiseRef.current ?? Promise.resolve();
        }

        controllerRef.current.abort();
      }

      const previousState = stateRef.current;
      const preservedDocument =
        previousState.documentId === nextDocumentId && previousState.resource.status === 'success'
          ? previousState.resource.data
          : null;
      const controller = new AbortController();
      const requestId = requestIdRef.current + 1;

      controllerRef.current = controller;
      requestIdRef.current = requestId;

      if (mode === 'refresh' && preservedDocument) {
        commit({
          documentId: nextDocumentId,
          resource: {
            data: preservedDocument,
            error: null,
            isRefreshing: true,
            refreshError: null,
            status: 'success',
          },
        });
      } else {
        commit({ documentId: nextDocumentId, resource: loadingResource() });
      }

      const request = (async () => {
        try {
          const data = await getDocumentById(nextDocumentId, { signal: controller.signal });

          if (
            controller.signal.aborted ||
            !mountedRef.current ||
            requestIdRef.current !== requestId
          ) {
            return;
          }

          commit({
            documentId: nextDocumentId,
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

          if (normalizedError.code === 'DOCUMENT_NOT_FOUND') {
            commit({ documentId: nextDocumentId, resource: notFoundResource() });
            return;
          }

          if (mode === 'refresh' && preservedDocument) {
            commit({
              documentId: nextDocumentId,
              resource: {
                data: preservedDocument,
                error: null,
                isRefreshing: false,
                refreshError: normalizedError,
                status: 'success',
              },
            });
            return;
          }

          commit({
            documentId: nextDocumentId,
            resource: {
              data: null,
              error: normalizedError,
              isRefreshing: false,
              refreshError: null,
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
    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      if (!validDocumentId) {
        controllerRef.current?.abort();
        requestIdRef.current += 1;
        commit({ documentId: routeDocumentId, resource: notFoundResource() });
        return;
      }

      void loadDocument(routeDocumentId, 'initial');
    });

    return () => {
      active = false;
      controllerRef.current?.abort();
    };
  }, [commit, loadDocument, routeDocumentId, validDocumentId]);

  const refresh = useCallback(() => {
    if (!validDocumentId) {
      return Promise.resolve();
    }

    const currentState = stateRef.current;
    const mode: LoadMode =
      currentState.documentId === routeDocumentId && currentState.resource.status === 'success'
        ? 'refresh'
        : 'initial';

    return loadDocument(routeDocumentId, mode);
  }, [loadDocument, routeDocumentId, validDocumentId]);

  const replaceDocument = useCallback(
    (document: PublicDocumentDetails) => {
      if (!validDocumentId || document.id !== routeDocumentId) {
        return false;
      }

      controllerRef.current?.abort();
      controllerRef.current = null;
      requestIdRef.current += 1;
      requestPromiseRef.current = null;
      commit({
        documentId: routeDocumentId,
        resource: {
          data: document,
          error: null,
          isRefreshing: false,
          refreshError: null,
          status: 'success',
        },
      });

      return true;
    },
    [commit, routeDocumentId, validDocumentId],
  );

  const resource =
    state.documentId === routeDocumentId
      ? state.resource
      : validDocumentId
        ? loadingResource()
        : notFoundResource();

  return { refresh, replaceDocument, resource };
}
