import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from './Button';

export interface PaginationProps {
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
}

export function Pagination({ currentPage, onPageChange, totalPages }: PaginationProps) {
  const safeTotalPages = Math.max(totalPages, 1);
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), safeTotalPages);

  return (
    <nav className="flex flex-wrap items-center justify-center gap-3" aria-label="Pagination">
      <Button
        size="small"
        variant="secondary"
        disabled={safeCurrentPage === 1}
        aria-label="Go to previous page"
        onClick={() => onPageChange(safeCurrentPage - 1)}
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Previous</span>
      </Button>
      <span className="min-w-24 text-center type-body text-secondary" aria-current="page">
        Page <strong className="text-foreground">{safeCurrentPage}</strong> of{' '}
        <strong className="text-foreground">{safeTotalPages}</strong>
      </span>
      <Button
        size="small"
        variant="secondary"
        disabled={safeCurrentPage === safeTotalPages}
        aria-label="Go to next page"
        onClick={() => onPageChange(safeCurrentPage + 1)}
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}
