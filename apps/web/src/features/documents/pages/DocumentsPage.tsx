import { RefreshCw, Upload } from 'lucide-react';
import { useState } from 'react';

import { Button, IconButton, useToast } from '../../../components/ui';
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
    <div className="documents-library min-w-0 pb-12">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="type-heading-1 font-semibold tracking-tight text-foreground sm:type-display">
            Documents
          </h1>
          <p className="mt-2 max-w-2xl type-body-large text-muted">
            Manage the PDFs that power your knowledge base.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <IconButton disabled={isListLoading} label="Refresh documents" onClick={refresh}>
            <RefreshCw
              className={
                isListLoading ? 'size-5 animate-soft-spin motion-reduce:animate-none' : 'size-5'
              }
              aria-hidden="true"
            />
          </IconButton>
          <Button className="flex-1 sm:flex-none" onClick={() => setUploadOpen(true)}>
            <Upload className="size-4" aria-hidden="true" />
            Upload document
          </Button>
        </div>
      </header>

      <div className="mt-7">
        <DocumentFilters
          counts={counts}
          onSearchChange={setSearchInput}
          onStatusChange={setStatus}
          search={searchInput}
          status={status}
        />
      </div>

      <div className="mt-5" aria-live="polite">
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
