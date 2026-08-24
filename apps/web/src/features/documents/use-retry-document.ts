import { useCallback, useEffect, useRef, useState } from 'react';

import { normalizeApiError } from '../../lib/api-client';
import { retryDocumentProcessing } from './documents.service';
import type { DocumentRetryResource, PublicDocumentDetails } from './documents.types';

export interface UseRetryDocumentOptions {
  documentId: string;
  onRetried: (document: PublicDocumentDetails) => void;
  onStateChanged: () => void;
  onUnavailable: () => void;
}

const idleResource: DocumentRetryResource = {
  error: null,
  status: 'idle',
};

export function useRetryDocument({
  documentId,
  onRetried,
  onStateChanged,
  onUnavailable,
}: UseRetryDocumentOptions) {
  const [resource, setResource] = useState<DocumentRetryResource>(idleResource);
  const documentIdRef = useRef(documentId);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const requestPromiseRef = useRef<Promise<void> | null>(null);
  const resourceRef = useRef(resource);

  const commit = useCallback((nextResource: DocumentRetryResource) => {
    resourceRef.current = nextResource;

    if (mountedRef.current) {
      setResource(nextResource);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    documentIdRef.current = documentId;
  }, [documentId]);

  const openDialog = useCallback(() => {
    if (!requestPromiseRef.current) {
      commit({ error: null, status: 'confirming' });
    }
  }, [commit]);

  const closeDialog = useCallback(() => {
    if (resourceRef.current.status !== 'retrying') {
      commit(idleResource);
    }
  }, [commit]);

  const confirmRetry = useCallback((): Promise<void> => {
    if (requestPromiseRef.current) {
      return requestPromiseRef.current;
    }

    if (resourceRef.current.status !== 'confirming' && resourceRef.current.status !== 'error') {
      return Promise.resolve();
    }

    const requestedDocumentId = documentId;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    commit({ error: null, status: 'retrying' });

    const request = (async () => {
      try {
        const retriedDocument = await retryDocumentProcessing(requestedDocumentId);

        if (
          !mountedRef.current ||
          requestIdRef.current !== requestId ||
          documentIdRef.current !== requestedDocumentId
        ) {
          return;
        }

        commit({ error: null, status: 'success' });
        onRetried(retriedDocument);
      } catch (error) {
        if (
          !mountedRef.current ||
          requestIdRef.current !== requestId ||
          documentIdRef.current !== requestedDocumentId
        ) {
          return;
        }

        const normalizedError = normalizeApiError(error);

        if (normalizedError.code === 'DOCUMENT_NOT_FOUND') {
          commit({ error: null, status: 'success' });
          onUnavailable();
          return;
        }

        if (normalizedError.code === 'INVALID_DOCUMENT_STATE') {
          commit({ error: null, status: 'success' });
          onStateChanged();
          return;
        }

        commit({ error: normalizedError, status: 'error' });
      } finally {
        if (requestIdRef.current === requestId) {
          requestPromiseRef.current = null;
        }
      }
    })();

    requestPromiseRef.current = request;
    return request;
  }, [commit, documentId, onRetried, onStateChanged, onUnavailable]);

  const isRetrying = resource.status === 'retrying';
  const isDialogOpen =
    resource.status === 'confirming' ||
    resource.status === 'retrying' ||
    resource.status === 'error';

  return {
    closeDialog,
    confirmRetry,
    isDialogOpen,
    isRetrying,
    openDialog,
    resource,
  };
}
