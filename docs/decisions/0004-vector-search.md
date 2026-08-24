# ADR-0004: Use PostgreSQL with pgvector for vector search

- Status: Accepted
- Date: 2026-07-16

## Context

Keyword search cannot reliably find relevant passages when a user's question and document use different words for the same concept. Grounded AI answers therefore need semantic retrieval: document chunks are represented as embeddings, and query embeddings are compared with them to find relevant authorized context.

The MVP already requires PostgreSQL for document ownership, metadata, processing state, and extracted chunks. Introducing a separate vector database would add another data store, synchronization path, permission boundary, backup process, and failure mode before the product has measured retrieval scale.

## Options considered

1. Store embeddings in PostgreSQL and search them with pgvector.
2. Use a separate managed vector database.
3. Use only keyword or full-text search.
4. Perform similarity search outside the database over application-loaded embeddings.

## Decision

Use the pgvector extension in PostgreSQL to store document-chunk embeddings and execute similarity search.

Vector retrieval must remain scoped by authenticated ownership and selected workspace, project, collection, or document boundaries. Semantic search will complement, not replace, metadata and keyword search.

## Consequences

- Relational metadata, authorization filters, chunks, and embeddings remain in one database.
- The MVP avoids operating and synchronizing a separate vector service.
- Deletion and consistency are simpler because derived vectors can follow the same ownership and transaction boundaries as document records.
- Prisma may not express every pgvector operation directly, so vector-specific migrations or parameterized raw SQL may be needed inside the persistence layer.
- Retrieval quality must be evaluated using known documents and questions rather than assumed from the technology choice.
- As data grows, vector dimensions, index strategy, query plans, latency, and recall must be measured and tuned.
- A separate vector database remains a future option if PostgreSQL cannot meet demonstrated scale, availability, or retrieval requirements. Retrieval code should therefore expose application-level interfaces rather than leak pgvector query details into business logic.

## Review trigger

Revisit this decision when measured corpus size, query load, latency, recall, or operational requirements exceed what PostgreSQL and pgvector can satisfy with appropriate indexing and query design.
