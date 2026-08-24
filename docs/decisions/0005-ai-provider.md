# ADR-0005: Use an AI provider abstraction with OpenAI

- Status: Accepted
- Date: 2026-07-16

## Context

The product needs AI capabilities for two bounded responsibilities:

- generate embeddings for document chunks and search queries;
- generate answers grounded in authorized passages retrieved by the application.

AI providers differ in APIs, model identifiers, embedding dimensions, response formats, limits, pricing, and failure behavior. Provider-specific details should not control document ownership, retrieval authorization, source references, or core business rules.

## Options considered

1. Define application-owned AI interfaces and use OpenAI as the initial implementation.
2. Call OpenAI directly from business logic without an abstraction.
3. Start with another managed AI provider.
4. Host embedding and generation models within the application infrastructure.

## Decision

Define separate application-owned interfaces for embedding generation and grounded answer generation. Implement those interfaces with OpenAI initially.

The application will select and authorize source passages before calling the provider. It will send only the context needed for the operation, validate provider responses, attach source references using application-owned metadata, and handle provider failures without exposing raw internal errors.

Provider model names, request types, and response types will remain inside infrastructure adapters. Stored embeddings must record enough model and dimension information to support safe re-indexing when models change.

## Consequences

- Core retrieval and answer workflows can be tested with deterministic fakes.
- Provider credentials and API details remain isolated on the server.
- Embedding and answer-generation providers can evolve independently if needed.
- Switching providers still requires compatibility work, evaluation, and potentially regenerating embeddings; the abstraction reduces coupling but does not make migration automatic.
- Direct calls would require less initial code, but would spread provider-specific behavior across the API and worker.
- Other managed providers remain viable if quality, privacy, availability, or cost requirements change.
- Self-hosted models would provide more operational control but add infrastructure and model-serving complexity that is not justified for the MVP.

## Review trigger

Revisit the initial provider when measured answer quality, embedding retrieval quality, privacy, regional availability, reliability, or cost no longer meets product requirements.
