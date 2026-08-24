# ADR-0008: Generate embeddings in a separate queue

- Status: Accepted
- Date: 2026-07-18

## Context

Document chunking and embedding generation have different failure modes, retry behavior, external dependencies, and costs. PDF extraction uses object storage and local CPU, while embedding generation calls an external AI provider and must persist fixed-dimension vectors for later semantic retrieval.

The MVP needs a clear boundary between creating stable chunks and enriching those chunks with embeddings. PostgreSQL with pgvector and an OpenAI provider abstraction are already approved.

## Options considered

1. Generate embeddings inside the existing document-processing job.
2. Submit a separate BullMQ embedding job after chunk persistence.
3. Generate embeddings synchronously in the upload request.
4. Defer embedding generation until the first search request.

## Decision

Use a separate `document-embedding` BullMQ queue and consumer. The document job stores chunks and moves the document to `CHUNKS_READY`, then submits an identifier-only embedding job. The embedding consumer moves the document to `EMBEDDING`, generates vectors through an application-owned abstraction, stores them transactionally, and marks the document `READY`.

Use OpenAI `text-embedding-3-small` with an explicit 1,536 dimensions for the MVP. PostgreSQL stores each vector as `vector(1536)` alongside `embeddingModel` and `embeddingDimensions`. No similarity index is added until retrieval queries and performance are measured.

## Consequences

- PDF parsing can complete and be retried independently from provider availability or rate limits.
- Provider-specific SDK types and credentials remain inside the OpenAI infrastructure adapter.
- Existing matching embeddings can be skipped during retry, and vector writes overwrite one chunk column rather than creating duplicate records.
- The document lifecycle exposes the asynchronous boundary through `CHUNKS_READY` and `EMBEDDING`.
- PostgreSQL and Redis still cannot be updated atomically. A failed enqueue leaves the document in `CHUNKS_READY`, allowing the document job to retry only queue submission.
- Changing the embedding model or dimensions requires controlled re-embedding and may require a schema migration.
- External API cost and rate limits now affect worker throughput and require later observability.

## Review trigger

Revisit batching, model choice, dimensions, and queue concurrency when retrieval evaluation, provider limits, cost, latency, or document sizes show that the MVP configuration is inadequate.
