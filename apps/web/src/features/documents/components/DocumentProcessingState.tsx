import { Circle, CircleAlert, CircleCheck, LoaderCircle, type LucideIcon } from 'lucide-react';

import { Alert, Card } from '../../../components/ui';
import { formatAbsoluteDate } from '../../../lib/date-format';
import type { DocumentApiState, PublicDocumentDetails } from '../documents.types';

export interface DocumentProcessingStateProps {
  document: PublicDocumentDetails;
}

type PipelineStepState = 'active' | 'done' | 'error' | 'pending';

interface PipelineStep {
  detail: string;
  key: string;
  label: string;
  state: PipelineStepState;
}

const stepIcons: Record<PipelineStepState, LucideIcon> = {
  done: CircleCheck,
  active: LoaderCircle,
  pending: Circle,
  error: CircleAlert,
};

const stepIconClassName: Record<PipelineStepState, string> = {
  done: 'text-status-ready-foreground',
  active: 'text-primary animate-soft-spin motion-reduce:animate-none',
  pending: 'text-muted',
  error: 'text-status-failed-foreground',
};

const stepLabelClassName: Record<PipelineStepState, string> = {
  done: 'text-foreground',
  active: 'text-foreground',
  pending: 'text-muted',
  error: 'text-foreground',
};

const stepDetailClassName: Record<PipelineStepState, string> = {
  done: 'text-muted',
  active: 'text-primary',
  pending: 'text-muted',
  error: 'text-status-failed-foreground',
};

/**
 * Builds the pipeline steps shown on the details page, using only what the backend actually
 * tracks (`processingState`, `createdAt`, `processedAt`). The backend cannot tell when parsing
 * ended and chunking began within a single PROCESSING state, and a FAILED document does not
 * retain which stage it stopped at — so those gaps are shown honestly ("In progress" / "Not
 * started" / a single failure marker) rather than invented.
 */
function buildPipelineSteps(document: PublicDocumentDetails): PipelineStep[] {
  const uploadedStep: PipelineStep = {
    key: 'uploaded',
    label: 'Uploaded',
    state: 'done',
    detail: formatAbsoluteDate(document.createdAt),
  };

  if (document.processingState === 'FAILED') {
    return [
      uploadedStep,
      {
        key: 'stopped',
        label: 'Processing stopped',
        state: 'error',
        detail: 'Could not finish — see the issue below.',
      },
    ];
  }

  const parsedAndChunkedDoneStates: DocumentApiState[] = ['CHUNKS_READY', 'EMBEDDING', 'READY'];
  const isParsedAndChunkedDone = parsedAndChunkedDoneStates.includes(document.processingState);
  const isParsedAndChunkedActive = document.processingState === 'PROCESSING';
  const isEmbeddedDone = document.processingState === 'READY';
  const isEmbeddedActive = document.processingState === 'EMBEDDING';

  function inlineState(done: boolean, active: boolean): PipelineStepState {
    if (done) {
      return 'done';
    }

    return active ? 'active' : 'pending';
  }

  function inlineDetail(done: boolean, active: boolean): string {
    if (done) {
      return 'Completed';
    }

    return active ? 'In progress' : 'Not started';
  }

  return [
    uploadedStep,
    {
      key: 'parsed',
      label: 'Parsed',
      state: inlineState(isParsedAndChunkedDone, isParsedAndChunkedActive),
      detail: inlineDetail(isParsedAndChunkedDone, isParsedAndChunkedActive),
    },
    {
      key: 'chunked',
      label: 'Chunked',
      state: inlineState(isParsedAndChunkedDone, isParsedAndChunkedActive),
      detail: inlineDetail(isParsedAndChunkedDone, isParsedAndChunkedActive),
    },
    {
      key: 'embedded',
      label: 'Embedded',
      state: inlineState(isEmbeddedDone, isEmbeddedActive),
      detail: inlineDetail(isEmbeddedDone, isEmbeddedActive),
    },
    {
      key: 'ready',
      label: 'Ready for search',
      state: isEmbeddedDone && document.processedAt ? 'done' : 'pending',
      detail:
        isEmbeddedDone && document.processedAt
          ? formatAbsoluteDate(document.processedAt)
          : 'Not started',
    },
  ];
}

export function DocumentProcessingState({ document }: DocumentProcessingStateProps) {
  const safeProcessingError = document.processingError?.trim();
  const steps = buildPipelineSteps(document);

  return (
    <Card className="document-details-decision-surface document-pipeline-card p-0" variant="solid">
      <section aria-labelledby="document-status-heading">
        <div className="border-b border-border/80 px-5 py-4 sm:px-6">
          <h2 id="document-status-heading" className="type-heading-3 font-semibold text-foreground">
            Pipeline
          </h2>
        </div>

        <ol className="document-pipeline-list px-5 py-5 sm:px-6">
          {steps.map((step, index) => {
            const Icon = stepIcons[step.state];

            return (
              <li key={step.key} className="document-pipeline-step" data-state={step.state}>
                <span className="document-pipeline-step-marker" aria-hidden="true">
                  <Icon className={`size-4 shrink-0 ${stepIconClassName[step.state]}`} />
                  {index < steps.length - 1 ? (
                    <span className="document-pipeline-step-connector" />
                  ) : null}
                </span>
                <span className="document-pipeline-step-body">
                  <span className={`type-body font-semibold ${stepLabelClassName[step.state]}`}>
                    {step.label}
                  </span>
                  <span className={`mt-0.5 type-small ${stepDetailClassName[step.state]}`}>
                    {step.detail}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>

        {document.status === 'processing' || document.status === 'failed' ? (
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            {document.status === 'processing' ? (
              <Alert title="Document processing" variant="warning">
                <p>
                  Processing can take a moment. Refresh this page to check for an updated status.
                </p>
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
        ) : null}
      </section>
    </Card>
  );
}
