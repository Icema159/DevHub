# ADR-0010: Generate grounded answers with application-owned conversations

- Status: Accepted
- Date: 2026-07-20

## Context

Semantic retrieval can return owner-scoped passages but does not yet answer a developer's question or retain a conversation. The answer path must preserve application authorization, make insufficient evidence explicit, store durable source snapshots, and isolate provider-specific request and response details.

An external model request cannot participate in the same PostgreSQL transaction as message persistence. Holding a database transaction open across the network call would increase lock time and still would not create atomicity between PostgreSQL and OpenAI.

## Options considered

1. Use an application-owned prompt and conversation flow through the OpenAI Responses API.
2. Use Chat Completions behind the same abstraction.
3. Use OpenAI-managed conversation state as the source of truth.
4. Save the USER message only after answer generation.
5. Save the USER message first and compensate it if the turn cannot be completed.

## Decision

Keep conversations and messages in PostgreSQL as the source of truth. Use a provider-neutral chat-generation interface in `packages/ai`, with the OpenAI Responses API as the first adapter and `gpt-5.6-sol` as the configurable initial model. Provider-side response storage is disabled for this stateless request path.

Build a bounded prompt from the current question and up to five retrieved chunks. Give sources stable labels such as `[S1]`, treat retrieved text as untrusted data, require answers to use only supplied evidence, and require a fixed insufficient-context response when evidence is absent. Validate returned labels against the supplied source set, and persist only sources actually cited in the answer. No previous conversation messages are added to model context in this phase.

Persist the USER message before retrieval. After generation, atomically create the ASSISTANT message, citation JSON snapshot, AI usage metadata, source-chunk relations, and conversation activity update. If retrieval, generation, or completion persistence fails, make a best-effort deletion of the newly created USER message before returning a safe error.

All conversation reads and writes filter by authenticated `userId` and `deletedAt IS NULL`. Missing, soft-deleted, and foreign-owned conversation identifiers share the same `404` behavior.

## Consequences

- Provider SDK types and raw errors stay outside controllers, repositories, and conversation business logic.
- Citation snapshots retain document name, chunk position, and page even if a later hard delete removes the live source relation.
- `Message.citations` and `Message.aiMetadata` keep evidence and generation concerns separate.
- Empty retrieval does not incur a model call and produces a deterministic grounded response.
- Usage and duration can be measured without maintaining a hardcoded pricing table; estimated cost remains deferred.
- Best-effort compensation prevents ordinary failures from leaving a misleading USER-only turn, but a process crash between writes can still leave a partial turn because the schema has no explicit turn status.
- Prior conversation history, streaming, reranking, document selection, and AI-generated titles remain separate future decisions.

## Review trigger

Revisit the model tier, output budget, compensation design, conversation-history strategy, and prompt contract after representative answer-quality, citation, latency, cost, concurrency, and crash-recovery measurements are available.
