# Technical documentation refresh: gap analysis

Audit date: 2026-08-26. Repository baseline: `83d3cc7`.

## Evidence and scope

The previous Lithuanian technical PDF, `DevHub_Systemos_Techninis_Aprasymas.pdf`, is a 13-page, 2026-08-21 v1.0 snapshot. All pages were read and rendered. Its 20 sections cover product, architecture, stack, frontend, API, data, documents, RAG, conversations, authentication, ownership, queues, storage, security, planned quotas, development, testing, deployment, roadmap, and invariants. No editable source for that PDF was found in this repository. The original is preserved unchanged.

Current application code and test sources were inspected read-only across all five workspaces, Prisma, environment validation, build scripts, Caddy, and documentation. Production success below is the operator's explicit confirmation, not a new deployment inspection or smoke test. No database, queue, storage, or provider operations were performed. Tests were inspected, not executed.

The new canonical source is [technical-documentation.md](technical-documentation.md). Its generated PDF is a distributable snapshot, not a separate source of truth. Existing focused documents remain the contract and implementation references.

## 1. CORRECT - retain

- Individual private libraries and route -> controller -> service -> repository separation.
- PostgreSQL/Prisma/pgvector, Redis/BullMQ, API/Worker separation, original files outside PostgreSQL.
- PDF-only ingestion, default 10 MiB upload, SHA-256 duplicate identity, ordered chunks and the six processing states.
- Same-owner, non-deleted, READY-only vector retrieval; generic unavailable responses for foreign resources.
- Opaque, hashed, revocable sessions; separate email-verification tokens; persisted messages and citation snapshots.
- Soft deletion before asynchronous object/database cleanup; one-command local development.

## 2. STALE - update

- Quotas and AI cost admission were future work in the PDF; durable reservations, burst limits, and a usage ledger now exist.
- Deployment is no longer merely planned: the operator confirms five Railway services and the main production path work.
- SMTP is not the production transport in this deployment; Resend HTTPS is selected, with optional SMTP retained.
- Browser and PDF hardening are implemented, not upcoming Phase 13B.4/13B.5 tasks.
- State amounts precisely: 150 MiB, not 150 decimal MB; worker concurrency is per process, not a global deployment guarantee.
- Old test totals and earlier phase recommendations are historical evidence, not current execution results.
- The AGENTS authentication rule still said JWT; current runtime authority is PostgreSQL-backed opaque sessions.

## 3. MISSING - add

- Public Caddy Web gateway, unchanged `/api` forwarding to a private API, PORT/upstream matching, frontend versus API health boundaries.
- Exact Responses API adapter and request shape; shared embeddings; internal model-pricing admission and safe-error/logging limitations.
- Session-bound CSRF, early Origin validation, private API no-store, production browser headers and proxy-trust configuration.
- PDF Worker Thread termination, page/text/chunk/time limits, stored-size/signature checks, and zero downstream embedding work on containment rejection.
- Quota and budget reservation models; all-row `(userId, fileHash)` uniqueness; exhausted cleanup implications.

## 4. PLANNED BUT NOT IMPLEMENTED - do not advertise

Some old product-scope statements, rather than the PDF's core pipeline, overstate the present UI: selected-document retrieval, Markdown upload, tag management, extracted-content keyword search, and opening the original cited file. Current retrieval spans the owner's READY library; citation navigation opens Document Details only. No viewer/download, OCR, streaming, conversation management UI, or permanent memory is added by this refresh.

## 5. IMPLEMENTED BUT UNDERDOCUMENTED - clarify

- Context is at most six recent USER/ASSISTANT messages, approximately three exchanges, not guaranteed complete pairs; the serialized bound is 6,000 characters.
- Retrieval context is deterministic concatenation, not a second LLM query-rewriting pipeline. History is not factual evidence.
- Empty retrieval skips answer generation but can still incur question-embedding and first-turn title cost.
- Citation snapshots and `aiMetadata` have separate responsibilities; estimated spend lives in the ledger, not the message DTO.
- Delete enqueue compensation reserves rollback capacity; successful storage deletion precedes database hard deletion.
- API/Worker build scripts generate Prisma and typecheck; production starts TypeScript via `tsx`, not compiled JS bundles.

## 6. SHOULD MOVE TO APPENDIX - preserve provenance

Detailed phase narratives, old passing-test totals, dated vulnerability triage, and decision-time limitations are historical reference material. Keep accepted ADRs intact and add an evolution note in their index. The new reference has a compact ADR map, source links, and test-evidence inventory rather than presenting old audit verdicts as a fresh security certification.

## 7. SHOULD MOVE TO FUTURE WORK - explicit boundaries

No transactional outbox, queue reconciliation service, orphan-object repair tool, full worker readiness endpoint, message POST idempotency contract, or deployment-wide concurrency control was found. Observability and repeatable backup/restore/rollback/CI acceptance remain work to verify or improve. Actual production PostgreSQL major/image, custom domain, sender-domain verification, replica/restart policy, and backup state were not inspected; these are unknown here, not asserted absent.

## Code-observed risks, not fixed or reproduced

1. **Embedding job ID after manual Retry.** The processing producer uses a fresh manual-retry ID, but the embedding producer always uses `embedding-${documentId}`. A retained failed embedding job can make a subsequent add a duplicate, potentially stranding freshly chunked work in CHUNKS_READY. The relevant producer is [document-embedding.queue.ts](../apps/worker/src/queues/document-embedding.queue.ts). A targeted full-flow recovery test is needed; this is not a newly verified production incident.
2. **Embedding failure before state transition.** Missing chunks or unavailable pricing can fail in CHUNKS_READY, while final embedding-failure persistence only targets EMBEDDING. An exhausted job may therefore leave an active-looking document. Inspect [embedding-processing.service.ts](../apps/worker/src/services/embedding-processing.service.ts) and [embedding.repository.ts](../apps/worker/src/repositories/embedding.repository.ts).
3. **Provider error visibility.** The conversation service converts generation failures to `AI_PROVIDER_UNAVAILABLE` without preserving/logging their original cause; known `AppError` responses are not logged by error middleware. This explains potentially unhelpful Railway logs without claiming that all logging is sanitized.
4. **Recovery and concurrency.** Queue delivery and failed-turn compensation are best effort; no per-conversation serialization or request idempotency exists. PDF threads bound JS execution but are not an OS/native-memory sandbox.

## Production evidence retained

The operator confirms registration, login, verification, upload, R2, parsing/chunking, embeddings, retrieval, grounded chat, visible citations, and successful cleanup. Short operational lessons cover corrected upstream port, Resend replacing blocked SMTP egress, malformed R2 configuration, and a recovered stale cleanup job. No raw logs, personal identifiers, credentials, real provider URLs, or incident resource IDs are reproduced.

## Validation of this refresh

- 163 local file/anchor links across the 12 changed/new Markdown documents checked: no broken targets.
- All 35 numbered reference sections and TOC anchors checked; five architecture/flow diagrams plus the provider request-shape block preserved.
- The final 24-page A4 PDF generated successfully. Every page was rendered and visually reviewed; representative diagrams, dense tables, Lithuanian text, and the complete one-page TOC were also inspected enlarged.
- PDF text/bounds checks found no missing-glyph replacement markers, raw local paths, unprocessed Markdown fences, or text outside the safe page area. The PDF includes clickable contents and repository-code references.
- Credential-pattern and long-secret-value scans of all changed Markdown found no matches; no real environment files or credentials were copied.
- `git diff --check` passed; all repository changes are Markdown or the generated PDF. The old PDF and individual ADR records remain untouched.
- Twelve existing external documentation/advisory URLs were retained, not freshly availability-checked. Production settings and provider policies were not inferred from them.

Application tests and live production checks are intentionally outside this documentation-only execution; historical results remain labelled as such. Rendering emitted environment-level Fontconfig cache warnings, but completed successfully with embedded fonts; final visual/text checks did not show font defects.
