import { FileQuestion } from 'lucide-react';

export function DocumentNotFoundState() {
  return (
    <section className="material-knowledge elevation-0 flex min-h-80 flex-col items-center justify-center rounded-card border border-dashed border-border-strong px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-card bg-primary-soft text-primary">
        <FileQuestion className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-4 type-heading-1 font-semibold text-foreground">Document not found</h1>
      <p className="mt-2 max-w-md type-body text-muted">
        This document may no longer exist or may not be available to your account.
      </p>
    </section>
  );
}
