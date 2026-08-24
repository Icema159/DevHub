import { CircleAlert, CircleCheck, Clock3, Files, type LucideIcon } from 'lucide-react';

import { Card, Skeleton } from '../../../components/ui';
import type { DashboardResource, DashboardDocumentList } from '../dashboard.types';
import { DashboardSectionError } from './DashboardSectionError';

export interface DocumentOverviewProps {
  onRetry: () => void;
  resource: DashboardResource<DashboardDocumentList>;
}

interface OverviewItem {
  description: string;
  icon: LucideIcon;
  key: keyof DashboardDocumentList['meta']['statusCounts'];
  label: string;
  tone: string;
}

const overviewItems: OverviewItem[] = [
  {
    key: 'all',
    label: 'Documents',
    description: 'In your knowledge base',
    icon: Files,
    tone: 'bg-info-soft text-info',
  },
  {
    key: 'ready',
    label: 'Ready',
    description: 'Available for AI search',
    icon: CircleCheck,
    tone: 'bg-success-soft text-success',
  },
  {
    key: 'processing',
    label: 'Processing',
    description: 'Processing and indexing',
    icon: Clock3,
    tone: 'bg-warning-soft text-warning',
  },
  {
    key: 'failed',
    label: 'Failed',
    description: 'Require attention',
    icon: CircleAlert,
    tone: 'bg-danger-soft text-danger',
  },
];

export function DocumentOverview({ onRetry, resource }: DocumentOverviewProps) {
  return (
    <section aria-labelledby="document-overview-heading">
      <h2 id="document-overview-heading" className="type-small font-semibold text-secondary">
        Knowledge overview
      </h2>

      {resource.status === 'loading' ? (
        <div
          className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4"
          aria-label="Loading document overview"
          role="status"
        >
          <span className="sr-only">Loading document overview</span>
          {overviewItems.map((item) => (
            <Skeleton key={item.key} className="h-28" variant="card" />
          ))}
        </div>
      ) : null}

      {resource.status === 'error' ? (
        <div className="mt-3">
          <DashboardSectionError message={resource.error.message} onRetry={onRetry} />
        </div>
      ) : null}

      {resource.status === 'success' ? (
        <dl className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {overviewItems.map(({ description, icon: Icon, key, label, tone }) => (
            <Card
              key={key}
              className="flex min-w-0 flex-col items-start gap-3 bg-white/95 p-4 sm:min-h-28 sm:flex-row sm:items-center sm:gap-4"
              variant="solid"
            >
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-card ${tone}`}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <dd className="block type-heading-1 font-semibold text-foreground">
                  {resource.data.meta.statusCounts[key]}
                </dd>
                <dt className="block type-body font-medium text-secondary">{label}</dt>
                <span className="mt-0.5 block type-small text-muted">{description}</span>
              </span>
            </Card>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
