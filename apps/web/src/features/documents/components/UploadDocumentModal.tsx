import { FileText, UploadCloud, X } from 'lucide-react';
import { useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react';

import { Alert, Button, IconButton, Modal } from '../../../components/ui';
import { normalizeApiError } from '../../../lib/api-client';
import { cn } from '../../../lib/cn';
import { formatFileSize } from '../../../lib/file-format';
import type { PublicDocument } from '../documents.types';

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

export function validatePdfFile(file: File | null): string | null {
  if (!file) {
    return 'Choose a PDF before uploading.';
  }

  if (file.size === 0) {
    return 'The selected PDF is empty.';
  }

  if (file.type !== 'application/pdf') {
    return 'Only PDF files are supported.';
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return 'This file is too large. The maximum size is 10 MB.';
  }

  return null;
}

export interface UploadDocumentModalProps {
  isUploading: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File) => Promise<PublicDocument>;
  open: boolean;
}

export function UploadDocumentModal({
  isUploading,
  onOpenChange,
  onUpload,
  open,
}: UploadDocumentModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;

  const reset = () => {
    setSelectedFile(null);
    setValidationError(null);
    setUploadError(null);
    setIsDragging(false);

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isUploading) {
      return;
    }

    if (!nextOpen) {
      reset();
    }

    onOpenChange(nextOpen);
  };

  const selectFile = (file: File | null) => {
    const error = validatePdfFile(file);

    setValidationError(error);
    setUploadError(null);
    setSelectedFile(error ? null : file);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    selectFile(event.target.files?.[0] ?? null);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    if (isUploading) {
      return;
    }

    if (event.dataTransfer.files.length !== 1) {
      setSelectedFile(null);
      setUploadError(null);
      setValidationError('Choose exactly one PDF file.');
      return;
    }

    selectFile(event.dataTransfer.files[0] ?? null);
  };

  const handleUpload = async () => {
    const error = validatePdfFile(selectedFile);

    if (error || !selectedFile) {
      setValidationError(error);
      return;
    }

    setUploadError(null);

    try {
      await onUpload(selectedFile);
      reset();
      onOpenChange(false);
    } catch (uploadFailure) {
      setUploadError(normalizeApiError(uploadFailure).message);
    }
  };

  return (
    <Modal
      closeDisabled={isUploading}
      confirmDisabled={!selectedFile}
      confirmLabel="Upload"
      confirmLoadingLabel="Uploading document…"
      description="Add a PDF to make its content searchable by your AI assistant."
      isConfirming={isUploading}
      onConfirm={() => void handleUpload()}
      onOpenChange={handleOpenChange}
      open={open}
      title="Upload document"
    >
      <div
        className={cn(
          'rounded-card border-2 border-dashed p-5 text-center transition',
          isDragging ? 'border-primary bg-primary-soft/80' : 'border-border-strong bg-slate-50/65',
          isUploading && 'opacity-60',
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!isUploading) setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsDragging(false);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={handleDrop}
      >
        <UploadCloud className="mx-auto size-9 text-primary" aria-hidden="true" />
        <p className="mt-3 font-semibold text-foreground">Drop a PDF here or choose a file</p>
        <p id={helpId} className="mt-1 type-small text-muted">
          PDF only · Maximum 10 MB
        </p>
        <input
          ref={inputRef}
          id={inputId}
          className="peer sr-only"
          type="file"
          accept=".pdf,application/pdf"
          disabled={isUploading}
          aria-describedby={`${helpId}${validationError ? ` ${errorId}` : ''}`}
          aria-invalid={validationError ? 'true' : undefined}
          onChange={handleFileChange}
        />
        <label
          className={cn(
            'mt-4 inline-flex min-h-11 items-center justify-center rounded-control border border-border-strong bg-white px-4 type-body font-semibold text-foreground shadow-sm transition',
            'cursor-pointer hover:border-primary/30 hover:bg-primary-soft/60 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary',
            isUploading && 'pointer-events-none opacity-50',
          )}
          htmlFor={inputId}
        >
          Choose PDF
        </label>
      </div>

      {selectedFile ? (
        <div className="mt-4 flex min-w-0 items-center gap-3 rounded-control border border-border bg-white p-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-danger-soft/65 text-danger">
            <FileText className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-foreground" title={selectedFile.name}>
              {selectedFile.name}
            </span>
            <span className="block type-small text-muted">{formatFileSize(selectedFile.size)}</span>
          </span>
          <IconButton
            className="size-9"
            disabled={isUploading}
            label="Remove selected file"
            onClick={() => selectFile(null)}
          >
            <X className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
      ) : null}

      {validationError ? (
        <p id={errorId} className="mt-3 type-small text-danger" role="alert">
          {validationError}
        </p>
      ) : null}

      {uploadError ? (
        <Alert className="mt-4" title="Upload failed" variant="error">
          {uploadError}
        </Alert>
      ) : null}

      {selectedFile && !isUploading ? (
        <Button className="mt-3 px-0" variant="ghost" onClick={() => inputRef.current?.click()}>
          Choose a different PDF
        </Button>
      ) : null}
    </Modal>
  );
}
