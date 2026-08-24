import { Alert, Card } from '../../../components/ui';
import type { PublicDocumentDetails } from '../documents.types';

export interface DocumentProcessingStateProps {
  document: PublicDocumentDetails;
}

export function DocumentProcessingState({ document }: DocumentProcessingStateProps) {
  const safeProcessingError = document.processingError?.trim();

  return (
    <Card className="document-details-decision-surface p-0" variant="solid">
      <section aria-labelledby="document-status-heading">
        <div className="border-b border-border/80 px-5 py-4 sm:px-6">
          <h2 id="document-status-heading" className="type-heading-3 font-semibold text-foreground">
            Processing status
          </h2>
        </div>

        <div className="p-5 sm:p-6">
          {document.status === 'ready' ? (
            <Alert title="Ready for AI search" variant="success">
              <p>This document can now be used for AI search and grounded answers.</p>
            </Alert>
          ) : null}

          {document.status === 'processing' ? (
            <Alert title="Document processing" variant="warning">
              <p>Processing can take a moment. Refresh this page to check for an updated status.</p>
            </Alert>
          ) : null}

          {document.status === 'failed' ? (
            <Alert title="Document processing failed" variant="error">
              {safeProcessingError ? (
                <div className="min-w-0">
                  <p className="font-medium">Processing issue</p>
                  <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {safeProcessingError}
                  </p>
                </div>
              ) : (
                <p>The document could not be processed.</p>
              )}
            </Alert>
          ) : null}
        </div>
      </section>
    </Card>
  );
}
