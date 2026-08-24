import { EllipsisVertical, FileText } from 'lucide-react';

import type { PublicDocumentStatus } from '../ui';
import { IconButton, StatusBadge } from '../ui';

export interface DocumentRowProps {
  filename: string;
  onOpenMenu?: () => void;
  status: PublicDocumentStatus;
  timestamp: string;
}

export function DocumentRow({ filename, onOpenMenu, status, timestamp }: DocumentRowProps) {
  return (
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
      <span className="flex size-10 items-center justify-center rounded-[10px] bg-danger-soft/60 text-danger">
        <FileText className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="truncate type-body font-medium text-foreground">{filename}</p>
        <p className="mt-0.5 type-small text-muted sm:hidden">{timestamp}</p>
      </div>
      <StatusBadge className="hidden sm:inline-flex" status={status} />
      <div className="flex items-center gap-2">
        <span className="hidden whitespace-nowrap type-small text-muted sm:inline">
          {timestamp}
        </span>
        <IconButton
          className="size-10 border-transparent bg-transparent shadow-none"
          label={`More options for ${filename}`}
          onClick={onOpenMenu}
        >
          <EllipsisVertical className="size-4" aria-hidden="true" />
        </IconButton>
      </div>
      <StatusBadge className="col-start-2 row-start-2 sm:hidden" status={status} />
    </div>
  );
}
