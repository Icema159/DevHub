import { useCallback, useEffect, useRef, useState } from 'react';

import { normalizeApiError } from '../../lib/api-client';
import { getDocuments, uploadDocument } from './documents.service';
import type {
  DocumentListQuery,
  DocumentListResource,
  DocumentStatusFilter,
  PublicDocument,
} from './documents.types';

const DOCUMENTS_PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 350;

function loadingResource(): DocumentListResource {
  return { data: null, error: null, status: 'loading' };
}

export function useDocuments() {
  const [resource, setResource] = useState<DocumentListResource>(loadingResource);
  const [page, setPageState] = useState(1);
  const [searchInput, setSearchInputState] = useState('');
  const [effectiveSearch, setEffectiveSearch] = useState('');
  const [status, setStatusState] = useState<DocumentStatusFilter>('ALL');
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const listControllerRef = useRef<AbortController | null>(null);
  const listRequestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const uploadControllerRef = useRef<AbortController | null>(null);
  const uploadPromiseRef = useRef<Promise<PublicDocument> | null>(null);

  const loadDocuments = useCallback(async (query: DocumentListQuery) => {
    listControllerRef.current?.abort();

    const controller = new AbortController();
    const requestId = listRequestIdRef.current + 1;
    listControllerRef.current = controller;
    listRequestIdRef.current = requestId;
    setResource(loadingResource());

    try {
      const data = await getDocuments(query, { signal: controller.signal });

      if (controller.signal.aborted || listRequestIdRef.current !== requestId) {
        return;
      }

      const lastAvailablePage = Math.max(data.meta.totalPages, 1);

      if (query.page > lastAvailablePage) {
        setPageState(lastAvailablePage);
        return;
      }

      setResource({ data, error: null, status: 'success' });
    } catch (error) {
      if (!controller.signal.aborted && listRequestIdRef.current === requestId) {
        setResource({ data: null, error: normalizeApiError(error), status: 'error' });
      }
    } finally {
      if (listControllerRef.current === controller) {
        listControllerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextSearch = searchInput.trim();

      if (nextSearch !== effectiveSearch) {
        setPageState(1);
        setEffectiveSearch(nextSearch);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [effectiveSearch, searchInput]);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      void loadDocuments({
        page,
        limit: DOCUMENTS_PER_PAGE,
        ...(effectiveSearch ? { search: effectiveSearch } : {}),
        status,
      });
    });

    return () => {
      active = false;
      listControllerRef.current?.abort();
    };
  }, [effectiveSearch, loadDocuments, page, refreshRevision, status]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      uploadControllerRef.current?.abort();
    };
  }, []);

  const setSearchInput = useCallback((value: string) => {
    setSearchInputState(value);
  }, []);

  const setStatus = useCallback(
    (nextStatus: DocumentStatusFilter) => {
      if (status !== nextStatus) {
        setPageState(1);
        setStatusState(nextStatus);
      }
    },
    [status],
  );

  const setPage = useCallback((nextPage: number) => {
    if (Number.isInteger(nextPage) && nextPage > 0) {
      setPageState(nextPage);
    }
  }, []);

  const refresh = useCallback(() => {
    if (!listControllerRef.current) {
      setRefreshRevision((current) => current + 1);
    }
  }, []);

  const upload = useCallback((file: File): Promise<PublicDocument> => {
    if (uploadPromiseRef.current) {
      return uploadPromiseRef.current;
    }

    const controller = new AbortController();
    uploadControllerRef.current = controller;
    setIsUploading(true);

    const promise = uploadDocument(file, { signal: controller.signal })
      .then((document) => {
        if (mountedRef.current) {
          setRefreshRevision((current) => current + 1);
        }

        return document;
      })
      .finally(() => {
        if (uploadControllerRef.current === controller) {
          uploadControllerRef.current = null;
        }

        uploadPromiseRef.current = null;

        if (mountedRef.current) {
          setIsUploading(false);
        }
      });

    uploadPromiseRef.current = promise;
    return promise;
  }, []);

  return {
    effectiveSearch,
    isUploading,
    page,
    refresh,
    resource,
    retry: refresh,
    searchInput,
    setPage,
    setSearchInput,
    setStatus,
    status,
    upload,
  };
}
