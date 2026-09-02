import {
  useEffect,
  useId,
  useRef,
  useState,
  type CompositionEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Send } from 'lucide-react';

import { Alert, Button } from '../../../components/ui';
import { cn } from '../../../lib/cn';
import {
  conversationMessageValidationError,
  MAX_CONVERSATION_MESSAGE_LENGTH,
} from '../conversations.service';
import {
  messageSubmissionErrorMessage,
  type MessageSubmissionOutcome,
  type MessageSubmissionResource,
} from '../use-conversation-messaging';

export interface MessageComposerProps {
  compact?: boolean;
  disabled: boolean;
  isSubmitting: boolean;
  onSubmit: (content: string) => Promise<MessageSubmissionOutcome>;
  resource: MessageSubmissionResource;
}

export function MessageComposer({
  compact = false,
  disabled,
  isSubmitting,
  onSubmit,
  resource,
}: MessageComposerProps) {
  const [draft, setDraft] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const composingRef = useRef(false);
  const mountedRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaId = useId();
  const validationId = `${textareaId}-validation`;
  const submissionId = `${textareaId}-submission`;
  const pendingId = `${textareaId}-pending`;
  const submissionError = messageSubmissionErrorMessage(resource);
  const characterCount = draft.length;
  const showCharacterCount = characterCount >= MAX_CONVERSATION_MESSAGE_LENGTH - 400;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea || textarea.scrollHeight === 0) {
      return;
    }

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [draft]);

  const submitDraft = async () => {
    const nextValidationError = conversationMessageValidationError(draft);

    if (nextValidationError || disabled || isSubmitting) {
      setValidationError(nextValidationError);
      return;
    }

    setValidationError(null);
    const outcome = await onSubmit(draft);

    if (!mountedRef.current || outcome.status === 'detached') {
      return;
    }

    if (outcome.clearDraft) {
      setDraft('');
    }

    textareaRef.current?.focus();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitDraft();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      composingRef.current ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();
    void submitDraft();
  };

  const handleComposition = (event: CompositionEvent<HTMLTextAreaElement>) => {
    composingRef.current = event.type === 'compositionstart';
  };

  const describedBy = [
    validationError ? validationId : null,
    submissionError ? submissionId : null,
    isSubmitting ? pendingId : null,
  ]
    .filter(Boolean)
    .join(' ');

  const textarea = (
    <textarea
      ref={textareaRef}
      id={textareaId}
      className={cn(
        'max-h-40 w-full resize-none bg-transparent px-2 py-1.5 type-body text-foreground outline-none placeholder:text-subtle disabled:cursor-not-allowed disabled:text-muted',
        compact ? 'min-h-12' : 'min-h-20',
      )}
      name="message"
      onChange={(event) => {
        const nextDraft = event.target.value;
        setDraft(nextDraft);

        if (validationError) {
          setValidationError(conversationMessageValidationError(nextDraft));
        }
      }}
      onCompositionEnd={handleComposition}
      onCompositionStart={handleComposition}
      onKeyDown={handleKeyDown}
      placeholder="Ask anything about your knowledge…"
      readOnly={disabled || isSubmitting}
      rows={compact ? 1 : 3}
      value={draft}
      aria-describedby={describedBy || undefined}
      aria-invalid={validationError ? 'true' : undefined}
    />
  );

  const helper = validationError ? (
    <p className="text-danger" id={validationId}>
      {validationError}
    </p>
  ) : showCharacterCount ? (
    <p className="text-muted" aria-live="polite">
      {characterCount.toLocaleString('en')} / {MAX_CONVERSATION_MESSAGE_LENGTH.toLocaleString('en')}
    </p>
  ) : compact ? null : (
    <p className="text-muted">Enter to send · Shift + Enter for a new line</p>
  );

  const sendButton = (
    <Button
      aria-label="Send message"
      className="chat-composer-send"
      disabled={disabled || draft.trim().length === 0}
      isLoading={isSubmitting}
      loadingLabel="Sending…"
      size="small"
      type="submit"
    >
      <Send className="size-4" aria-hidden="true" />
      <span className="chat-composer-send-label">Send</span>
    </Button>
  );

  const submissionStatus = isSubmitting ? (
    <p
      className="chat-composer-status mt-2 text-center type-small text-muted"
      id={pendingId}
      role="status"
    >
      {resource.status === 'submitting' && resource.phase === 'generating'
        ? 'Generating answer…'
        : 'Retrieving relevant sources…'}
    </p>
  ) : disabled ? (
    <p className="chat-composer-status mt-2 text-center type-small text-muted" role="status">
      Another question is still being processed.
    </p>
  ) : null;

  return (
    <form
      className={cn(
        'chat-composer-dock relative z-10 border-t border-border/60 bg-white/18 p-3 supports-[backdrop-filter]:backdrop-blur-sm sm:p-4',
        compact && 'chat-composer-compact',
      )}
      onSubmit={handleSubmit}
      aria-busy={isSubmitting || undefined}
    >
      {submissionError ? (
        <Alert
          className="mx-auto mb-3 max-w-4xl"
          title="Message could not be completed"
          variant="error"
        >
          <p id={submissionId}>{submissionError}</p>
        </Alert>
      ) : null}

      <div className="material-interaction chat-composer-shell elevation-2 mx-auto max-w-4xl rounded-action border p-px">
        <label className="sr-only" htmlFor={textareaId}>
          Message
        </label>
        {compact ? (
          <>
            <div
              className={cn(
                'chat-composer-input-surface chat-composer-pill rounded-card border bg-white/94 p-2 shadow-glass-low transition focus-within:border-primary/55 focus-within:ring-3 focus-within:ring-primary/12',
                validationError
                  ? 'border-danger focus-within:border-danger focus-within:ring-danger/15'
                  : 'border-border-strong',
              )}
            >
              {textarea}
              {sendButton}
            </div>
            {helper ? (
              <div className="chat-composer-helper min-w-0 type-caption">{helper}</div>
            ) : null}
          </>
        ) : (
          <div
            className={cn(
              'chat-composer-input-surface rounded-card border bg-white/94 p-2 shadow-glass-low transition focus-within:border-primary/55 focus-within:ring-3 focus-within:ring-primary/12',
              validationError
                ? 'border-danger focus-within:border-danger focus-within:ring-danger/15'
                : 'border-border-strong',
            )}
          >
            {textarea}

            <div className="flex items-end justify-between gap-3 px-1 pb-1">
              <div className="min-w-0 type-caption">{helper}</div>
              {sendButton}
            </div>
          </div>
        )}

        {submissionStatus}
      </div>
    </form>
  );
}
