import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Alert, Button, useToast } from '../../../components/ui';
import { usePageTitle } from '../../../lib/page-title';
import {
  DeleteDocumentDialog,
  DocumentDetailsHeader,
  DocumentDetailsSkeleton,
  DocumentInformationCard,
  DocumentManagementCard,
  DocumentNotFoundState,
  DocumentProcessingState,
  DocumentRecoveryCard,
  RetryDocumentDialog,
} from '../components';
import type { DocumentDetailsResource } from '../documents.types';
import { useDeleteDocument } from '../use-delete-document';
import { useDocumentDetails } from '../use-document-details';
import { useRetryDocument } from '../use-retry-document';

const MAX_PAGE_TITLE_LENGTH = 80;

function safePageTitle(resource: DocumentDetailsResource): string {
  if (resource.status !== 'success') {
    return 'Document';
  }

  const characters = Array.from(resource.data.filename);

  return characters.length > MAX_PAGE_TITLE_LENGTH
    ? `${characters.slice(0, MAX_PAGE_TITLE_LENGTH - 1).join('')}…`
    : resource.data.filename;
}

function BackToDocumentsLink() {
  return (
    <Link
      className="inline-flex min-h-11 items-center gap-2 rounded-control px-2 type-body font-semibold text-secondary transition hover:bg-white/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      to="/documents"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Back to documents
    </Link>
  );
}

export function DocumentDetailsPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { refresh, replaceDocument, resource } = useDocumentDetails(documentId);
  const handleDeleted = useCallback(() => {
    navigate('/documents', { replace: true });
    showToast({
      title: 'Document removed',
      message:
        'It is no longer available in your knowledge base. Final cleanup will continue in the background.',
      variant: 'success',
    });
  }, [navigate, showToast]);
  const handleUnavailable = useCallback(() => {
    navigate('/documents', { replace: true });
    showToast({
      title: 'Document unavailable',
      message: 'This document is no longer available.',
      variant: 'info',
    });
  }, [navigate, showToast]);
  const deletion = useDeleteDocument({
    documentId: documentId ?? '',
    onDeleted: handleDeleted,
    onUnavailable: handleUnavailable,
  });
  const handleRetried = useCallback(
    (document: Parameters<typeof replaceDocument>[0]) => {
      if (!replaceDocument(document)) {
        return;
      }

      showToast({
        title: 'Processing restarted',
        message:
          'The document is being prepared again. Refresh the page later to check its status.',
        variant: 'success',
      });
    },
    [replaceDocument, showToast],
  );
  const handleRetryStateChanged = useCallback(() => {
    showToast({
      title: 'Document status changed',
      message: 'The latest document state is being loaded.',
      variant: 'info',
    });
    void refresh();
  }, [refresh, showToast]);
  const retry = useRetryDocument({
    documentId: documentId ?? '',
    onRetried: handleRetried,
    onStateChanged: handleRetryStateChanged,
    onUnavailable: handleUnavailable,
  });

  usePageTitle(safePageTitle(resource));

  return (
    <div className="document-details-v3 mx-auto min-w-0 max-w-[80rem] pb-12">
      <div className="-ml-2 mb-5">
        <BackToDocumentsLink />
      </div>

      {resource.status === 'loading' ? (
        <>
          <h1 className="sr-only">Document</h1>
          <DocumentDetailsSkeleton />
        </>
      ) : null}

      {resource.status === 'not-found' ? <DocumentNotFoundState /> : null}

      {resource.status === 'error' ? (
        <section className="material-knowledge elevation-0 rounded-card border p-5 sm:p-6">
          <h1 className="type-heading-1 font-semibold tracking-tight text-foreground sm:type-display">
            Unable to load document
          </h1>
          <Alert className="mt-5" title="Document details are unavailable" variant="error">
            <p>{resource.error.message}</p>
            <Button
              className="mt-4"
              onClick={() => void refresh()}
              size="small"
              variant="secondary"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          </Alert>
        </section>
      ) : null}

      {resource.status === 'success' ? (
        <div>
          <DocumentDetailsHeader
            document={resource.data}
            isRefreshing={resource.isRefreshing}
            onRefresh={() => void refresh()}
            refreshDisabled={deletion.isDialogOpen || retry.isDialogOpen}
          />

          {resource.refreshError ? (
            <Alert className="mt-5" title="Could not refresh document" variant="error">
              <p>{resource.refreshError.message}</p>
            </Alert>
          ) : null}

          <div className="mt-6 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.8fr)] xl:items-start xl:gap-6">
            <div className="order-1 min-w-0 xl:order-2 xl:col-start-2 xl:row-start-1">
              <DocumentProcessingState document={resource.data} />
            </div>

            {resource.data.status === 'failed' ? (
              <div className="order-2 min-w-0 xl:order-3 xl:col-start-2 xl:row-start-2">
                <DocumentRecoveryCard
                  disabled={resource.isRefreshing || deletion.isDialogOpen || retry.isRetrying}
                  onRetry={retry.openDialog}
                />
              </div>
            ) : null}

            <div className="order-3 min-w-0 xl:order-1 xl:col-start-1 xl:row-start-1 xl:row-span-3">
              <DocumentInformationCard document={resource.data} />
            </div>

            <div
              className={`order-4 min-w-0 xl:col-start-2 ${
                resource.data.status === 'failed' ? 'xl:row-start-3' : 'xl:row-start-2'
              }`}
            >
              <DocumentManagementCard
                disabled={resource.isRefreshing || deletion.isDeleting || retry.isDialogOpen}
                onDelete={deletion.openDialog}
              />
            </div>
          </div>

          <RetryDocumentDialog
            error={retry.resource.status === 'error' ? retry.resource.error : null}
            filename={resource.data.filename}
            isRetrying={retry.isRetrying}
            onCancel={retry.closeDialog}
            onConfirm={() => void retry.confirmRetry()}
            open={retry.isDialogOpen}
          />

          <DeleteDocumentDialog
            error={deletion.resource.status === 'error' ? deletion.resource.error : null}
            filename={resource.data.filename}
            isDeleting={deletion.isDeleting}
            onCancel={deletion.closeDialog}
            onConfirm={() => void deletion.confirmDelete()}
            open={deletion.isDialogOpen}
          />
        </div>
      ) : null}
    </div>
  );
}
