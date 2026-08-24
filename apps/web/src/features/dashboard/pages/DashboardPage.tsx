import { FileUp, MessageCircleMore, Sparkles } from 'lucide-react';
import { Link } from 'react-router';

import { Card } from '../../../components/ui';
import { useAuthStore } from '../../auth';
import { usePageTitle } from '../../../lib/page-title';
import { useDashboardData } from '../use-dashboard-data';
import {
  AttentionDocuments,
  DashboardActionLink,
  DocumentOverview,
  RecentConversations,
  RecentDocuments,
} from '../components';

function firstName(name: string | null | undefined): string | null {
  return name?.trim().split(/\s+/)[0] || null;
}

export function DashboardPage() {
  usePageTitle('Dashboard');

  const user = useAuthStore((state) => state.user);
  const {
    conversations,
    documents,
    failedDocuments,
    retryConversations,
    retryDocuments,
    retryFailedDocuments,
  } = useDashboardData();
  const displayFirstName = firstName(user?.name);
  const isNewKnowledgeBase =
    documents.status === 'success' && documents.data.meta.statusCounts.all === 0;

  return (
    <div className="min-w-0 pb-12">
      <header className="max-w-3xl">
        <h1 className="break-words type-heading-1 font-semibold tracking-tight text-foreground sm:type-display">
          {displayFirstName ? `Welcome back, ${displayFirstName}` : 'Welcome back'}
        </h1>
        <p className="mt-2 type-body-large text-muted">
          Your AI knowledge workspace. Upload documents, chat, and get answers from your knowledge
          base.
        </p>
      </header>

      <section className="mt-7 grid gap-4 md:grid-cols-2" aria-label="Primary actions">
        <DashboardActionLink
          description="Add PDFs to your knowledge base and make them searchable."
          icon={FileUp}
          label="Upload document"
          to="/documents"
        />
        <DashboardActionLink
          description="Start a conversation and get answers from your documents."
          icon={MessageCircleMore}
          label="New chat"
          to="/chat"
        />
      </section>

      {isNewKnowledgeBase ? (
        <Card
          className="mt-5 flex flex-col gap-4 border-primary/15 bg-white/95 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
          variant="solid"
        >
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-card bg-primary-soft text-primary">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="type-heading-3 font-semibold text-foreground">
                Build your knowledge base
              </h2>
              <p className="mt-1 max-w-2xl type-body text-muted">
                Upload your first PDF to make its content searchable and available to your AI
                assistant.
              </p>
            </div>
          </div>
          <Link
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-control bg-primary px-4 type-body font-semibold text-white shadow-glass-low transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary"
            to="/documents"
          >
            Upload your first document
          </Link>
        </Card>
      ) : null}

      <div className="mt-7">
        <DocumentOverview resource={documents} onRetry={() => void retryDocuments()} />
      </div>

      <div className="dashboard-sections-grid mt-6 grid min-w-0 gap-5">
        <RecentDocuments resource={documents} onRetry={() => void retryDocuments()} />
        <RecentConversations resource={conversations} onRetry={() => void retryConversations()} />
        <AttentionDocuments
          className="dashboard-attention-section"
          resource={failedDocuments}
          onRetry={() => void retryFailedDocuments()}
        />
      </div>
    </div>
  );
}
