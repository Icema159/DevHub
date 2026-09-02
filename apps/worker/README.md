# Background worker

The worker consumes the `document.process`, `document.embed`, and `document.delete` BullMQ jobs. Queue payloads contain only `documentId` and `userId`; PostgreSQL and object storage remain the sources of document state and file contents.

The queue names are `document-processing`, `document-embedding`, and `document-deletion`.
All use three total attempts with exponential backoff starting at 1,000 ms; completed retention is
3,600 seconds / 1,000 jobs, failed retention 24 hours / 5,000 jobs. Processing/embedding concurrency
defaults to one each and is configurable; cleanup concurrency is one per process. These are not
deployment-wide limits across multiple replicas. The entry point is `src/worker.ts`; production
intentionally runs through `tsx` so the isolated parser's TypeScript loader remains available.

## PDF containment and AI admission

`src/config/pdf-processing.ts` centralizes 150 pages, 1,000,000 extracted JS string code units,
1,000 chunks, and a 30-second parser timeout. The parser runs in a termination-capable Worker
Thread (256 MiB old heap, 32 MiB young heap, 4 MiB stack). This is not an OS sandbox or a
whole-process/native-memory cap. Storage size and `%PDF-` are revalidated before parsing; text and
chunk limits are checked before persistence. Chunks are page-aware, at most 1,200 code units,
without overlap; token counts are character-based estimates, not tokenizer output.

Rejected PDFs cannot enqueue embeddings, call the embedding provider, or reserve embedding
budget through the normal processing path. The separate embedding consumer reserves global AI
budget before provider work; budget denial delays the same job instead of failing a healthy
CHUNKS_READY document. Embeddings use shared `packages/ai`, model `text-embedding-3-small`,
dimensions 1536, and batches of at most 100 inputs. Vector persistence and READY completion are
transactional. See [security](../../docs/security.md) and the [technical reference](../../docs/technical-documentation.md).

## Retry and failure behavior

A failed attempt does not by itself mean that the document has failed. Inside each processor, the worker reads the job's configured `attempts` value and compares it with BullMQ's current `attemptsMade` value before BullMQ records that failure.

- A retryable `document.process` failure leaves the document in `PROCESSING` or `CHUNKS_READY` with no processing error.
- A retryable `document.embed` failure after its transition leaves the document in `EMBEDDING` with no processing error; a pre-transition failure can leave CHUNKS_READY.
- The final configured attempt tries a guarded `FAILED` update with a safe error and `processedAt = null` before rethrowing. It only updates the expected active state; pre-EMBEDDING failures can leave CHUNKS_READY as noted below.
- Established unrecoverable processing failures trigger an immediate guarded failure-recording attempt and are rethrown as BullMQ `UnrecoverableError` values. Invalid job contracts and ownership/state guards may prevent a document update.
- Worker `failed` listeners only log. They do not update PostgreSQL because BullMQ emits `failed` for intermediate retryable attempts too.

Successful retries use the existing idempotent chunk and vector writes. Embedding completion sets `READY`, clears `processingError`, and records `processedAt`.

## Document cleanup

The API first sets `Document.deletedAt`, which immediately excludes the document from user-facing reads and semantic retrieval. The cleanup worker then:

1. reloads the matching owner-scoped soft-deleted record;
2. deletes the private local/R2 object;
3. deletes chunks, embeddings, and source-link rows;
4. deletes the document row.

Missing storage objects and database rows are safe success cases. Other cleanup errors are thrown for BullMQ retry. Processing and embedding repositories require `deletedAt IS NULL` for transitions and completion, so concurrent deletion cannot recreate document content.

An exhausted cleanup job leaves its row hidden and can continue blocking identical uploads through
`(userId, fileHash)` uniqueness. There is no built-in reconciliation/admin recovery service.
Missing Redis jobs do not themselves repair database state. Manual processing Retry has a fresh
job ID, but subsequent embedding enqueue uses fixed `embedding-${documentId}`; a retained failed
job can collide. Also, failures before EMBEDDING can miss its final-state update. These are
code-inspection recovery risks requiring targeted verification, not newly reproduced incidents.
