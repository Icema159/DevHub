import type { z } from 'zod';

import type { ApiClientError } from '../../lib/api-client';
import type {
  conversationDetailResponseSchema,
  conversationMessageCreateResponseSchema,
  conversationMessageStreamEventSchema,
  conversationMessageSchema,
  conversationPaginationSchema,
  conversationRecordSchema,
  conversationSourceSchema,
  conversationSummarySchema,
} from './conversations.schemas';

export type PublicConversation = z.infer<typeof conversationRecordSchema>;
export type PublicConversationSummary = z.infer<typeof conversationSummarySchema>;
export type PublicConversationDetail = z.infer<
  typeof conversationDetailResponseSchema
>['data']['conversation'];
export type PublicConversationMessage = z.infer<typeof conversationMessageSchema>;
export type PublicConversationSource = z.infer<typeof conversationSourceSchema>;
export type ConversationTurnResult = z.infer<
  typeof conversationMessageCreateResponseSchema
>['data'];
export type ConversationMessageStreamEvent = z.infer<typeof conversationMessageStreamEventSchema>;
export type ConversationPagination = z.infer<typeof conversationPaginationSchema>;

export interface ConversationListResult {
  conversations: PublicConversationSummary[];
  meta: ConversationPagination;
}

export type ConversationListResource =
  | {
      data: null;
      error: null;
      isRefreshing: false;
      status: 'loading';
    }
  | {
      data: ConversationListResult;
      error: null;
      isRefreshing: boolean;
      refreshError: ApiClientError | null;
      status: 'success';
    }
  | {
      data: null;
      error: ApiClientError;
      isRefreshing: false;
      status: 'error';
    };

export type SelectedConversationResource =
  | {
      data: null;
      error: null;
      status: 'loading';
    }
  | {
      data: PublicConversationDetail;
      error: null;
      status: 'success';
    }
  | {
      data: null;
      error: null;
      status: 'not-found';
    }
  | {
      data: null;
      error: ApiClientError;
      status: 'error';
    };

export type SelectedConversationRefreshResult =
  | {
      data: PublicConversationDetail;
      status: 'success';
    }
  | {
      status: 'not-found' | 'cancelled';
    }
  | {
      error: ApiClientError;
      status: 'error';
    };

export type CreateConversationResource =
  | {
      error: null;
      status: 'idle' | 'creating' | 'success';
    }
  | {
      error: ApiClientError;
      status: 'error';
    };
