# Background worker

The worker consumes the `document.process`, `document.embed`, and `document.delete` BullMQ jobs. Queue payloads contain only `documentId` and `userId`; PostgreSQL and object storage remain the sources of document state and file contents.

## Retry and failure behavior

A failed attempt does not by itself mean that the document has failed. Inside each processor, the worker reads the job's configured `attempts` value and compares it with BullMQ's current `attemptsMade` value before BullMQ records that failure.

- A retryable `document.process` failure leaves the document in `PROCESSING` or `CHUNKS_READY` with no processing error.
- A retryable `document.embed` failure leaves the document in `EMBEDDING` with no processing error.
- The final configured attempt records `FAILED`, a safe user-facing error, and `processedAt = null` before rethrowing the original error.
- Established unrecoverable validation or deterministic processing failures record `FAILED` immediately and are rethrown as BullMQ `UnrecoverableError` values.
- Worker `failed` listeners only log. They do not update PostgreSQL because BullMQ emits `failed` for intermediate retryable attempts too.

Successful retries use the existing idempotent chunk and vector writes. Embedding completion sets `READY`, clears `processingError`, and records `processedAt`.

## Document cleanup

The API first sets `Document.deletedAt`, which immediately excludes the document from user-facing reads and semantic retrieval. The cleanup worker then:

1. reloads the matching owner-scoped soft-deleted record;
2. deletes the private local/R2 object;
3. deletes chunks, embeddings, and source-link rows;
4. deletes the document row.

Missing storage objects and database rows are safe success cases. Other cleanup errors are thrown for BullMQ retry. Processing and embedding repositories require `deletedAt IS NULL` for transitions and completion, so concurrent deletion cannot recreate document content.
