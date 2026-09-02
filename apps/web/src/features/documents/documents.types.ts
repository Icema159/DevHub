import type { ApiClientError } from '../../lib/api-client';
import type { PublicDocumentStatus } from '../../components/ui';

export type DocumentApiState =
  'PENDING' | 'PROCESSING' | 'CHUNKS_READY' | 'EMBEDDING' | 'READY' | 'FAILED';

export type DocumentStatusFilter = 'ALL' | 'READY' | 'PROCESSING' | 'FAILED';

export interface PublicDocument {
  createdAt: string;
  filename: string;
  id: string;
  mimeType: string;
  processedAt: string | null;
  size: number;
  status: PublicDocumentStatus;
  updatedAt: string;
}

export interface PublicDocumentDetails extends PublicDocument {
  processingError: string | null;
  /**
   * The raw backend processing state (PENDING/PROCESSING/CHUNKS_READY/EMBEDDING/READY/FAILED),
   * kept alongside the coarse public `status` so the details page can render an honest,
   * step-by-step pipeline without inventing data the backend does not track (e.g. no separate
   * "parsed" vs "chunked" timestamps, no page/fragment/vector counts).
   */
  processingState: DocumentApiState;
}

export interface PublicDeletedDocument {
  deletedAt: string;
  id: string;
}

export interface DocumentStatusCounts {
  all: number;
  failed: number;
  processing: number;
  ready: number;
}

export interface DocumentList {
  documents: PublicDocument[];
  meta: {
    limit: number;
    page: number;
    statusCounts: DocumentStatusCounts;
    total: number;
    totalPages: number;
  };
}

export interface DocumentListQuery {
  limit: number;
  page: number;
  search?: string;
  status: DocumentStatusFilter;
}

export type DocumentListResource =
  | {
      data: null;
      error: null;
      status: 'loading';
    }
  | {
      data: DocumentList;
      error: null;
      status: 'success';
    }
  | {
      data: null;
      error: ApiClientError;
      status: 'error';
    };

export type DocumentDetailsResource =
  | {
      data: null;
      error: null;
      isRefreshing: false;
      refreshError: null;
      status: 'loading';
    }
  | {
      data: PublicDocumentDetails;
      error: null;
      isRefreshing: boolean;
      refreshError: ApiClientError | null;
      status: 'success';
    }
  | {
      data: null;
      error: null;
      isRefreshing: false;
      refreshError: null;
      status: 'not-found';
    }
  | {
      data: null;
      error: ApiClientError;
      isRefreshing: false;
      refreshError: null;
      status: 'error';
    };

export type DocumentDeletionResource =
  | {
      error: null;
      status: 'idle' | 'confirming' | 'deleting' | 'success';
    }
  | {
      error: ApiClientError;
      status: 'error';
    };

export type DocumentRetryResource =
  | {
      error: null;
      status: 'idle' | 'confirming' | 'retrying' | 'success';
    }
  | {
      error: ApiClientError;
      status: 'error';
    };
