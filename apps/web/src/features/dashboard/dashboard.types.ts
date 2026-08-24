import type { ApiClientError } from '../../lib/api-client';
import type { PublicDocumentStatus } from '../../components/ui';
import type {
  ConversationListResult,
  PublicConversationSummary,
} from '../conversations/conversations.types';

export interface DashboardDocument {
  createdAt: string;
  filename: string;
  id: string;
  mimeType: string;
  processedAt: string | null;
  size: number;
  status: PublicDocumentStatus;
  updatedAt: string;
}

export interface DashboardStatusCounts {
  all: number;
  failed: number;
  processing: number;
  ready: number;
}

export interface DashboardDocumentList {
  documents: DashboardDocument[];
  meta: {
    limit: number;
    page: number;
    statusCounts: DashboardStatusCounts;
    total: number;
    totalPages: number;
  };
}

export type DashboardConversation = PublicConversationSummary;
export type DashboardConversationList = ConversationListResult;

export type DashboardResource<T> =
  | {
      data: null;
      error: null;
      status: 'loading';
    }
  | {
      data: T;
      error: null;
      status: 'success';
    }
  | {
      data: null;
      error: ApiClientError;
      status: 'error';
    };
