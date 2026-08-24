import { useCallback, useEffect, useRef, useState } from 'react';

import { normalizeApiError } from '../../lib/api-client';
import {
  getFailedDocuments,
  getRecentConversations,
  getRecentDocuments,
} from './dashboard.service';
import type {
  DashboardConversationList,
  DashboardDocumentList,
  DashboardResource,
} from './dashboard.types';

function loadingResource<T>(): DashboardResource<T> {
  return { data: null, error: null, status: 'loading' };
}

export function useDashboardData() {
  const [documents, setDocuments] =
    useState<DashboardResource<DashboardDocumentList>>(loadingResource);
  const [conversations, setConversations] =
    useState<DashboardResource<DashboardConversationList>>(loadingResource);
  const [failedDocuments, setFailedDocuments] =
    useState<DashboardResource<DashboardDocumentList>>(loadingResource);

  const documentsController = useRef<AbortController | null>(null);
  const conversationsController = useRef<AbortController | null>(null);
  const failedDocumentsController = useRef<AbortController | null>(null);

  const loadDocuments = useCallback(async () => {
    if (documentsController.current) {
      return;
    }

    const controller = new AbortController();
    documentsController.current = controller;
    setDocuments(loadingResource());

    try {
      const data = await getRecentDocuments({ signal: controller.signal });

      if (!controller.signal.aborted) {
        setDocuments({ data, error: null, status: 'success' });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setDocuments({ data: null, error: normalizeApiError(error), status: 'error' });
      }
    } finally {
      if (documentsController.current === controller) {
        documentsController.current = null;
      }
    }
  }, []);

  const loadConversations = useCallback(async () => {
    if (conversationsController.current) {
      return;
    }

    const controller = new AbortController();
    conversationsController.current = controller;
    setConversations(loadingResource());

    try {
      const data = await getRecentConversations({ signal: controller.signal });

      if (!controller.signal.aborted) {
        setConversations({ data, error: null, status: 'success' });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setConversations({ data: null, error: normalizeApiError(error), status: 'error' });
      }
    } finally {
      if (conversationsController.current === controller) {
        conversationsController.current = null;
      }
    }
  }, []);

  const loadFailedDocuments = useCallback(async () => {
    if (failedDocumentsController.current) {
      return;
    }

    const controller = new AbortController();
    failedDocumentsController.current = controller;
    setFailedDocuments(loadingResource());

    try {
      const data = await getFailedDocuments({ signal: controller.signal });

      if (!controller.signal.aborted) {
        setFailedDocuments({ data, error: null, status: 'success' });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setFailedDocuments({ data: null, error: normalizeApiError(error), status: 'error' });
      }
    } finally {
      if (failedDocumentsController.current === controller) {
        failedDocumentsController.current = null;
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      void loadDocuments();
      void loadConversations();
      void loadFailedDocuments();
    });

    return () => {
      active = false;
      documentsController.current?.abort();
      conversationsController.current?.abort();
      failedDocumentsController.current?.abort();
    };
  }, [loadConversations, loadDocuments, loadFailedDocuments]);

  return {
    conversations,
    documents,
    failedDocuments,
    retryConversations: loadConversations,
    retryDocuments: loadDocuments,
    retryFailedDocuments: loadFailedDocuments,
  };
}
