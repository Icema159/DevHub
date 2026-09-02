# Architecture Decision Records

This folder stores decisions that materially affect the product or architecture. An ADR records why a choice was made at that time; it does not prevent a later decision from replacing it.

## Decision index

- [ADR-0001: Use a monorepo with npm workspaces](0001-monorepo-architecture.md)
- [ADR-0002: Use an object storage abstraction with Cloudflare R2](0002-object-storage.md)
- [ADR-0003: Use PostgreSQL with Prisma ORM](0003-database-layer.md)
- [ADR-0004: Use PostgreSQL with pgvector for vector search](0004-vector-search.md)
- [ADR-0005: Use an AI provider abstraction with OpenAI](0005-ai-provider.md)
- [ADR-0006: Target individual developers first](0006-target-individual-developers-first.md)
- [ADR-0007: Use pdf-parse behind a worker parser abstraction](0007-pdf-text-extraction.md)
- [ADR-0008: Generate embeddings in a separate queue](0008-embedding-pipeline.md)
- [ADR-0009: Use owner-scoped cosine retrieval](0009-semantic-retrieval.md)
- [ADR-0010: Generate grounded answers with application-owned conversations](0010-rag-answer-generation.md)
- [ADR-0011: Use revocable server-side sessions and verified email capability](0011-server-sessions-email-verification.md)

## Evolution note (2026-08-26)

Accepted ADRs preserve decision-time scope; their "not in this phase" statements are not the
current feature inventory. Later work added bounded conversation context and titles (after
ADR-0010), durable quotas and a local model-pricing/budget ledger (after ADR-0008/0010/0011),
Worker Thread PDF containment (after ADR-0007), and the current Caddy/Railway deployment. ADR-0011
records the active server-session/email architecture; historical JWT delivery notes are superseded.
See [current architecture](../architecture.md), [security](../security.md), and the
[technical reference](../technical-documentation.md). The original ADR texts remain unchanged.

## Naming

Use sequential files:

```text
0001-short-decision-title.md
0002-another-decision.md
```

## Template

```md
# ADR-NNNN: Decision title

- Status: Proposed | Accepted | Superseded
- Date: YYYY-MM-DD

## Context

What problem or constraint requires a decision?

## Options considered

Which realistic alternatives were compared?

## Decision

What did we choose?

## Consequences

What becomes easier, harder, or intentionally deferred?

## Review trigger

Which new evidence would make us revisit the decision?
```
