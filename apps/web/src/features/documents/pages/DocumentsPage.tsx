import { RefreshCw, Upload } from 'lucide-react';
import { useState } from 'react';

import { Button, useToast } from '../../../components/ui';
import { usePageTitle } from '../../../lib/page-title';
import { DocumentFilters, DocumentList, UploadDocumentModal } from '../components';
import type { PublicDocument } from '../documents.types';
import { useDocuments } from '../use-documents';

export function DocumentsPage() {
  usePageTitle('Documents');

  const [uploadOpen, setUploadOpen] = useState(false);
  const { showToast } = useToast();
  const {
    effectiveSearch,
    isUploading,
    page,
    refresh,
    resource,
    retry,
    searchInput,
    setPage,
    setSearchInput,
    setStatus,
    status,
    upload,
  } = useDocuments();

  const handleUpload = async (file: File): Promise<PublicDocument> => {
    const document = await upload(file);

    showToast({
      title: 'Document uploaded',
      message: 'Processing has started. It will become available for AI search when ready.',
      variant: 'success',
    });

    return document;
  };

  const isListLoading = resource.status === 'loading';
  const counts = resource.status === 'success' ? resource.data.meta.statusCounts : null;

  return (
    <div className="documents-library documents-v4-page min-w-0 pb-12">
      <header className="documents-v4-page-heading flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="type-heading-1 font-semibold tracking-tight text-foreground sm:type-display">
            Documents
          </h1>
          <p className="mt-2 max-w-2xl type-body-large text-muted">
            The PDFs that power your answers.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            aria-label="Refresh documents"
            className="documents-v4-refresh"
            disabled={isListLoading}
            onClick={refresh}
            size="small"
            variant="secondary"
          >
            <RefreshCw
              className={
                isListLoading ? 'size-4 animate-soft-spin motion-reduce:animate-none' : 'size-4'
              }
              aria-hidden="true"
            />
            Refresh
          </Button>
          <Button
            className="documents-v4-upload flex-1 sm:flex-none"
            onClick={() => setUploadOpen(true)}
          >
            <Upload className="size-4" aria-hidden="true" />
            Upload document
          </Button>
        </div>
      </header>

      <div className="documents-v4-workspace material-workspace elevation-1 mt-6 overflow-hidden rounded-glass border">
        <DocumentFilters
          counts={counts}
          onSearchChange={setSearchInput}
          onStatusChange={setStatus}
          search={searchInput}
          status={status}
        />

        <div className="documents-v4-results" aria-live="polite">
          <DocumentList
            effectiveSearch={effectiveSearch}
            onClearSearch={() => setSearchInput('')}
            onPageChange={setPage}
            onRetry={retry}
            onUpload={() => setUploadOpen(true)}
            resource={resource}
            status={status}
          />
        </div>
      </div>

      <UploadDocumentModal
        isUploading={isUploading}
        onOpenChange={setUploadOpen}
        onUpload={handleUpload}
        open={uploadOpen}
      />

      {page > 1 && isListLoading ? (
        <p className="sr-only" role="status">
          Loading page {page}
        </p>
      ) : null}
    </div>
  );
}
