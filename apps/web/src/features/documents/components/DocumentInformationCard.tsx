import { CalendarClock, CalendarPlus, FileType2, HardDrive, RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Card } from '../../../components/ui';
import { formatAbsoluteDate } from '../../../lib/date-format';
import { formatFileSize } from '../../../lib/file-format';
import type { PublicDocumentDetails } from '../documents.types';

interface InformationRow {
  Icon: LucideIcon;
  label: string;
  secondary?: string;
  value: string;
}

export interface DocumentInformationCardProps {
  document: PublicDocumentDetails;
}

export function DocumentInformationCard({ document }: DocumentInformationCardProps) {
  const rows: InformationRow[] = [
    {
      Icon: FileType2,
      label: 'File type',
      secondary: document.mimeType,
      value: 'PDF document',
    },
    {
      Icon: HardDrive,
      label: 'File size',
      value: formatFileSize(document.size),
    },
    {
      Icon: CalendarPlus,
      label: 'Added',
      value: formatAbsoluteDate(document.createdAt),
    },
    {
      Icon: RefreshCw,
      label: 'Last updated',
      value: formatAbsoluteDate(document.updatedAt),
    },
  ];

  if (document.processedAt) {
    rows.push({
      Icon: CalendarClock,
      label: 'Processed',
      value: formatAbsoluteDate(document.processedAt),
    });
  }

  return (
    <Card className="document-details-knowledge-surface p-0" variant="solid">
      <section aria-labelledby="document-information-heading">
        <div className="border-b border-border/80 px-5 py-4 sm:px-6">
          <h2
            id="document-information-heading"
            className="type-heading-3 font-semibold text-foreground"
          >
            Details
          </h2>
        </div>

        <dl className="divide-y divide-border/80 px-5 sm:px-6">
          <div className="grid min-w-0 gap-2 py-4 sm:grid-cols-[minmax(9rem,0.45fr)_minmax(0,1fr)] sm:items-center">
            <dt className="flex items-center gap-3 type-body font-medium text-secondary">
              <FileType2 className="size-4 shrink-0 text-muted" aria-hidden="true" />
              File name
            </dt>
            <dd
              className="break-words type-body text-foreground [overflow-wrap:anywhere] sm:text-right"
              title={document.filename}
            >
              {document.filename}
            </dd>
          </div>

          {rows.map(({ Icon, label, secondary, value }) => (
            <div
              key={label}
              className="grid min-w-0 gap-2 py-4 sm:grid-cols-[minmax(9rem,0.45fr)_minmax(0,1fr)] sm:items-center"
            >
              <dt className="flex items-center gap-3 type-body font-medium text-secondary">
                <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
                {label}
              </dt>
              <dd className="min-w-0 type-body text-foreground sm:text-right">
                <span className="block">{value}</span>
                {secondary ? (
                  <span className="mt-0.5 block break-all type-small text-muted">{secondary}</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </Card>
  );
}
