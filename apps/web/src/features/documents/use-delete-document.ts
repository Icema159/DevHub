import { useCallback, useEffect, useRef, useState } from 'react';

import { normalizeApiError } from '../../lib/api-client';
import { deleteDocument } from './documents.service';
import type { DocumentDeletionResource, PublicDeletedDocument } from './documents.types';

export interface UseDeleteDocumentOptions {
  documentId: string;
  onDeleted: (document: PublicDeletedDocument) => void;
  onUnavailable: () => void;
}

const idleResource: DocumentDeletionResource = {
  error: null,
  status: 'idle',
};

export function useDeleteDocument({
  documentId,
  onDeleted,
  onUnavailable,
}: UseDeleteDocumentOptions) {
  const [resource, setResource] = useState<DocumentDeletionResource>(idleResource);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const requestPromiseRef = useRef<Promise<void> | null>(null);
  const resourceRef = useRef(resource);

  const commit = useCallback((nextResource: DocumentDeletionResource) => {
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

  const openDialog = useCallback(() => {
    if (!requestPromiseRef.current) {
      commit({ error: null, status: 'confirming' });
    }
  }, [commit]);

  const closeDialog = useCallback(() => {
    if (resourceRef.current.status !== 'deleting') {
      commit(idleResource);
    }
  }, [commit]);

  const confirmDelete = useCallback((): Promise<void> => {
    if (requestPromiseRef.current) {
      return requestPromiseRef.current;
    }

    if (resourceRef.current.status !== 'confirming' && resourceRef.current.status !== 'error') {
      return Promise.resolve();
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    commit({ error: null, status: 'deleting' });

    const request = (async () => {
      try {
        const deletedDocument = await deleteDocument(documentId);

        if (!mountedRef.current || requestIdRef.current !== requestId) {
          return;
        }

        commit({ error: null, status: 'success' });
        onDeleted(deletedDocument);
      } catch (error) {
        if (!mountedRef.current || requestIdRef.current !== requestId) {
          return;
        }

        const normalizedError = normalizeApiError(error);

        if (normalizedError.code === 'DOCUMENT_NOT_FOUND') {
          commit({ error: null, status: 'success' });
          onUnavailable();
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
  }, [commit, documentId, onDeleted, onUnavailable]);

  const isDeleting = resource.status === 'deleting';
  const isDialogOpen =
    resource.status === 'confirming' ||
    resource.status === 'deleting' ||
    resource.status === 'error';

  return {
    closeDialog,
    confirmDelete,
    isDeleting,
    isDialogOpen,
    openDialog,
    resource,
  };
}
