# ADR-0009: Use owner-scoped cosine retrieval

- Status: Accepted
- Date: 2026-07-18

## Context

Document chunks now contain OpenAI `text-embedding-3-small` vectors with 1,536 dimensions. The API needs a first semantic retrieval operation that can find conceptually related passages without generating an answer. Retrieval must preserve the same ownership boundary as document access and must not send another user's content to an AI provider or API caller.

The MVP does not yet have corpus-size, latency, recall, or relevance measurements that justify an approximate vector index or a separate vector database.

## Options considered

1. Use pgvector cosine distance with an owner filter in the database query.
2. Use pgvector inner-product or Euclidean distance.
3. Load vectors into application memory and rank them in Node.js.
4. Introduce a separate vector database.

## Decision

Embed each normalized question through the same application-owned embedding service used for document chunks. Search `vector(1536)` values with pgvector cosine distance and expose similarity as `1 - cosine distance`.

Apply the authenticated `userId` filter in the same SQL query that ranks chunks. Search only `READY` documents whose embedding model and dimensions match the question vector. Return at most five ranked chunks by default. Use exact search without a vector similarity index until measurements justify one.

Keep the OpenAI adapter and provider-neutral embedding service in `packages/ai`, which both the API and worker consume. Keep raw pgvector SQL inside the API repository layer.

## Consequences

- Ownership is enforced before rows can enter the result set rather than filtered after retrieval.
- Question and chunk vectors use the same model and dimension contract.
- Controllers remain unaware of OpenAI and SQL details, while services remain unaware of pgvector syntax.
- Exact search provides the simplest correctness baseline but will scan more vectors as an individual user's corpus grows.
- The fixed top-five limit bounds the response and future answer context, but relevance thresholds and evaluation are still needed.
- A model change requires controlled document re-embedding before queries can use the new model.

## Review trigger

Revisit the top-K value, threshold, metric, and index choice after a representative relevance set and PostgreSQL query-plan measurements show a quality or latency problem. Consider HNSW, IVFFlat, or separate vector infrastructure only when measured requirements justify their recall and operational trade-offs.
