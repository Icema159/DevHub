# Learning and implementation roadmap

Each phase should introduce the minimum new complexity needed to understand the problem being solved. A phase is complete only when its behavior, trade-offs, and verification can be explained.

## Current position

As of 2026-08-26, the operator confirms the five Railway services and the main production
registration/verification/upload/R2/Worker/embedding/retrieval/RAG/citation/cleanup path are working.
Broader Phase 14.3B deployment acceptance is not declared complete by this documentation refresh.
See [the technical reference](technical-documentation.md) for evidence boundaries and remaining
recovery/observability work. Delivery entries and test totals below record historical phase results,
not fresh test execution or current future-work instructions.

- Phase 0 product definition is complete.
- Phase 1 has completed the initial component, persistence, storage, vector search, and AI provider decisions. The accepted decisions are recorded in `docs/decisions/`.
- Delivery task 5.3 initialized the npm workspaces monorepo and package scaffolds.
- Delivery task 5.4 added shared TypeScript, ESLint, Prettier, and environment configuration.
- Delivery task 5.5 added local PostgreSQL and Redis configuration through Docker Compose.
- Delivery task 6.2 implemented and validated the initial Prisma schema and its reviewed constraints.
- Delivery task 6.3 installed Prisma 7 and its PostgreSQL adapter, applied the first local migration with pgvector enabled, and generated Prisma Client.
- Delivery task 7.1 added the Express API entry point, environment and Prisma integration, layered health-check flow, and centralized error handling.
- Delivery task 7.2.1 added validated registration and login, bcrypt password hashing, safe public user responses, and initial API unit tests.
- Delivery task 7.2.2 added access JWT issuance, an HttpOnly authentication cookie, authentication middleware, the protected current-user endpoint, and logout.
- Delivery task 7.3 added a consistent authenticated-user context, a reusable service-layer ownership rule, and authentication and authorization behavior tests.
- Delivery task 8.1 added authenticated PDF upload, SHA-256 duplicate detection, object-storage adapters, `PENDING` document persistence, and owner-scoped document listing.
- Delivery task 8.2 added the shared BullMQ job contract, API queue producer, worker entry point and consumer, retry policy, and idempotent `PENDING` to `PROCESSING` transition.
- Delivery task 8.3 added worker-side local/R2 file retrieval, isolated PDF text extraction, deterministic page-aware chunking, transactional chunk replacement, and `READY`/`FAILED` lifecycle transitions.
- Delivery task 8.4 added a separate embedding queue and consumer, an OpenAI provider abstraction using `text-embedding-3-small`, 1,536-dimensional pgvector persistence, and the intermediate `CHUNKS_READY` and `EMBEDDING` lifecycle states.
- Delivery task 8.5 added a protected semantic retrieval endpoint, shared API/worker embedding integration, owner-scoped pgvector cosine search, and ranked top-five chunk results.
- Delivery task 8.6 added owner-scoped conversations, grounded prompt construction, provider-neutral answer generation, citation/source persistence, safe insufficient-context behavior, and generation usage metadata.
- Delivery task 9B.3 corrected both BullMQ consumers so retryable attempt failures remain active and only exhausted or explicitly unrecoverable work becomes `FAILED` with a safe error.
- Delivery task 9B.4 added owner-scoped manual restart for terminally failed documents, transactional stale-artifact cleanup, duplicate-request protection, and compensated submission to the existing processing queue.
- Delivery task 9B.5 added owner-scoped document soft deletion, immediate list/detail/RAG exclusion, and idempotent asynchronous storage/chunk/vector cleanup through `document.delete`.
- Delivery task 10.2 aligned the conversation backend with the approved Chat UX through best-effort generated titles, latest-USER-message previews, and owner-scoped pagination.
- Delivery task 10.3 added bounded current-conversation context for follow-up retrieval and grounded answer generation while keeping retrieved documents as the factual source.
- Delivery task 11.0 initialized `apps/web` with React 19, Vite 8, and TypeScript; added a Tailwind CSS 4 semantic-token design system, reusable UI primitives, a responsive authenticated shell, placeholder product routes, a `/ui-kit` showcase, and Vitest/React Testing Library coverage.
- Delivery task 11.1 added the centralized frontend API client, safe public error model, runtime-validated auth service, non-persisted Zustand session state, Login/Register pages, startup session restoration, protected routing, real App Shell identity, and backend-driven logout.
- Delivery task 11.2 replaced the Dashboard placeholder with a responsive API-backed workspace that composes real document counts, recent documents, conversations, and failed-document attention data through cancellable parallel requests and independent section states.
- Delivery task 11.3 replaced the Documents placeholder with an owner-scoped, responsive library using backend filename search, grouped status filters, pagination, cancellable requests, distinct empty states, and validated multipart PDF upload.
- Delivery task 11.4 added a protected, owner-scoped Document Details page with runtime-validated public metadata, grouped processing states, safe failure information, request cancellation, stale-response protection, manual refresh, and generic missing/foreign/deleted handling.
- Delivery task 11.5 added safe Document Details deletion with an accessible confirmation dialog, duplicate-submit prevention, runtime validation of the `202 Accepted` DTO, replacement navigation, and accurate immediate-removal versus asynchronous-cleanup feedback.
- Delivery task 11.6 added Failed-only Document Details Retry with accessible confirmation, duplicate-submit prevention, runtime validation of the same-ID Processing DTO, stale-read invalidation, and Retry/Delete/Refresh coordination. It also made the conversation repository ordering test independent of the calendar date without changing production behavior.
- Delivery task 11.7A replaced the Chat placeholder with a responsive Conversations Workspace using shared runtime-validated list/create/detail contracts, URL-backed backend pagination, explicit server-confirmed creation, direct owner-scoped routes, nullable title/preview fallbacks, and stale-response protection. Message history and sending remain the next frontend boundary.
- Delivery task 11.7B added the persisted USER/ASSISTANT thread, accessible multiline composer, runtime-validated message submission, duplicate prevention, server-authoritative turn/title/preview refresh, failure compensation reconciliation, plain-text safety, responsive behavior, and stale mutation/read protection.
- Delivery task 11.7C added runtime-validated, backend-ordered ASSISTANT source cards with accessible labels, optional page display, safe internal Document Details navigation, duplicate preservation, and strict separation from USER messages and internal chunk metadata.
- Delivery task 11.7D is complete. Local integration proved real PDF processing, 1,536-dimensional embeddings, configured OpenAI providers, grounded multi-turn answers with persisted citations, canonical insufficient-context behavior, cross-user isolation, and deleted-source citation snapshots. Controlled-browser acceptance proved conversation creation, first and follow-up messages, persisted refresh, Back/Forward, citation rendering and navigation, repeated-Enter locking, responsive layouts, semantic labels, and a clean console. Final acceptance additionally proved two-user foreign document/conversation URL privacy, exact content-only message POSTs with cookie authentication, delayed route switching without duplicates or state leakage, and safe accessible `page: null`, long, and HTML-looking citation filenames without overflow. The earlier React StrictMode aborted-read defect remains covered by its focused regression test. No new production defect was found during final acceptance.
- Delivery task 12.1 translated the approved V3 direction into a reusable visual foundation: a restrained atmospheric canvas; Navigation, Workspace, Solid Knowledge, and Elevated Interaction materials; localized glass-edge light; three elevation levels; a signature Sidebar and selected-state language; independent typography and semantic foreground utilities; WCAG AA Button and status tokens; shared focus, reduced-motion, and no-backdrop-filter behavior; and matching UI Kit coverage. Representative browser QA passed without new horizontal overflow or console warnings.
- Delivery task 12.2 applied the approved V3 direction to the real Chat Workspace. Conversations now use Workspace Glass and the shared selected-state language; the thread keeps USER messages secondary and ASSISTANT answers on Solid Knowledge surfaces; citations are compact stacked evidence rows; and the Composer uses Elevated Interaction Glass. The split workspace now begins at 1280 px, so 1024 px and narrower routes show one usable workspace at a time. Controlled browser QA covered all required viewports, real conversation states, navigation, sending, citations, loading/error recovery, responsive overflow, and console behavior.
- Delivery task 12.2B completed the focused Chat identity calibration. The Chat-only atmospheric field is modestly stronger; Navigation, Workspace, and Interaction Glass now have clearer opacity relationships, localized asymmetric environmental edge response, and restrained optical thickness; the solid New conversation action has a refined tonal/specular treatment; and ASSISTANT knowledge and citation surfaces remain unchanged. Three staged 1440 px browser passes, a baseline/V3/production comparison, responsive checks, a forced no-backdrop-filter render, accessibility inspection, and the full frontend regression suite passed.
- Delivery task 12.2C completed Dynamic Ambient Refraction and Living Glass for Chat. One inert AppShell-level layer now moves exactly three diffuse light fields beneath stable UI surfaces using de-synchronized transform-only 34–43 second cycles. Desktop Navigation, Workspace, and Interaction Glass received small supported-browser translucency adjustments, while mobile uses calmer fields and more opaque reading chrome. Reduced motion preserves a static atmosphere, no-backdrop-filter fallbacks remain opaque, and ASSISTANT, citation, USER, textarea, and CTA surfaces remain stable. Staged 1440 px comparison, 15-second motion observation, four-view responsive checks, accessibility/fallback inspection, and the full frontend regression suite passed.
- Delivery task 12.3 is complete. It implemented the Dashboard V3 layout and material hierarchy without changing its three real owner-scoped data requests. Dashboard now shares the approved Living Glass environment and Sidebar with Chat; primary navigation actions use restrained indigo Interaction Glass; real metrics use mostly-solid semantic surfaces; and recent/attention areas remain Solid Knowledge. Mockup-only search, artwork, green branding, inline Retry, menus, activity, progress values, and analytics remain excluded. Populated and empty 1440 × 900 browser checks, long/plain-text safety, real route navigation, focus, overflow, console review, and the 290-test frontend regression passed. Final standalone browser acceptance also passed at 1280 × 800, 1024 × 768, and 390 × 844, including loading, error, reduced-motion, and opaque no-backdrop-filter fallback paths, with no acceptance-breaking regression.
- Delivery task 12.4 is complete. It evolved the real `/documents` route into the Documents Library V3 management workspace while preserving owner-scoped API behavior, debounced filename search, processing filters and real counts, refresh, upload, details navigation, and pagination. The route shares the approved Living Glass environment and Sidebar; search and filters use one restrained Interaction Glass surface; and the library remains a stable Solid Management surface. Desktop uses the full table at 1280 px and above, while narrower layouts use a compact semantic list without horizontal overflow. The 291-test frontend regression and all web/root quality checks passed. Controlled and explicitly approved standalone browser QA covered the complete responsive/state matrix, reduced motion, opaque no-backdrop fallback, keyboard order, clean console, and one-request-per-action network behavior.
- Delivery task 12.5 and the final Phase 12 acceptance are complete. The real `/documents/:documentId` route is now a responsive inspection and lifecycle workspace: document identity and Refresh use restrained Interaction Glass, while metadata, lifecycle, recovery, and management remain Solid Knowledge/Decision surfaces. `PENDING`, `PROCESSING`, `CHUNKS_READY`, and `EMBEDDING` stay truthfully grouped as Processing; Retry remains Failed-only; and Delete, Refresh, authorization, and API behavior are unchanged. Final product-wide browser acceptance covered 35 scenarios across Login, Register, Dashboard, Documents, Details, Chat, dialogs, mobile navigation, the UI Kit, all lifecycle and forced states, five Details viewports, reduced motion, opaque fallback, safe hostile text, network sanity, and the corrected Composer rim. The 292-test frontend regression and all required web/root quality checks passed. Phase 12 is frozen and its implemented rules are recorded in `docs/design-manifesto.md`.
- Security task 13B.1 is complete. Stateless JWT authority was replaced by seven-day PostgreSQL-backed opaque sessions with hashed credentials, current-session logout revocation, internal revoke-all support, and secure local/production cookie variants. New accounts use hashed 60-minute single-use email-verification tokens, generic non-enumerating registration, authenticated resend, a provider-neutral sender abstraction with Resend HTTPS delivery in Railway production, and a minimal verification-required frontend flow. Redis-backed fixed-window limits now protect registration, login, resend, and verification submission and fail closed when limiter state is unavailable. Unverified users remain authenticated but are backend-blocked from upload, Retry, semantic search, and AI answer generation. Owner-scoped repositories and existing product behavior remain unchanged.
- Security task 13B.2 is complete. A two-agent read-only audit found no Critical, High, or Medium owner-isolation vulnerability. Adversarial API, repository, pgvector, and worker tests now prove generic foreign-resource denial, parent-scoped message and citation access, pre-ranking vector ownership filters, soft-delete exclusion, and rejection of forged job ownership. Public conversation history excludes internal `SYSTEM` rows, and assistant source persistence revalidates owner, deletion, and `READY` state. The current guarantees and remaining trusted boundaries are recorded in `docs/security.md`.
- Security task 13B.3 is complete. A PostgreSQL-backed ResourceGuard now atomically enforces 25 non-deleted documents, 150 MiB of original PDF bytes, two active document pipelines, and 30 successful AI answer turns per rolling 24 hours for each authenticated owner. Redis fixed-window controls bound upload and AI attempts per trusted Express IP and fail closed only on those protected expensive routes. Every OpenAI question-embedding, answer, title, and document-embedding path reserves against a durable $20 UTC monthly application budget and records an integer-micro-USD usage estimate. Budget-blocked embedding jobs remain `CHUNKS_READY` and move to a bounded BullMQ delay rather than becoming `FAILED`; reads, authentication, deletion, and cleanup remain operational. Minimal existing UI error surfaces explain limit denials without adding a usage dashboard.
- Security task 13B.5.2 is complete. Multipart complexity is bounded before upload business logic; stored size and signature are revalidated; PDF parsing runs in a termination-capable Worker Thread; centralized 150-page, 1,000,000-character, 1,000-chunk, and 30-second limits fail safely and without BullMQ retries; and rejected files cannot create chunks, embedding work, provider calls, or AI-budget reservations.
- Refresh-token behavior, extracted-content/metadata search, and long-term memory have not been created yet. Chat streaming has since shipped (see below).
- Remaining task-specific decisions will be made before the phase that needs them.

## Numbering note

Identifiers such as 5.3, 5.4, 5.5, and 6.2 refer to detailed delivery tasks. The numbered sections below describe higher-level product capabilities. These identifiers should not be treated as the same sequence when reporting progress.

## Phase 0 — Product definition

- define the target user and problem;
- define the MVP and non-goals;
- describe the core user journey;
- establish product principles and success criteria;
- list open questions for architecture work.

## Phase 1 — System architecture

Status: Initial high-level architecture and core technology decisions completed.

- choose repository structure and system boundaries;
- map synchronous and asynchronous data flows;
- define security and ownership boundaries;
- decide how local development will run;
- record major decisions as ADRs.

## Phase 2 — Data model

Status: Prisma models, ownership relations, soft deletion, sessions, verification, quota/budget records, constraints, and migrations are implemented. Migrations enable pgvector and constrain vectors to 1,536 dimensions. The API-owned production `prisma:migrate:deploy` workflow exists. A standalone ERD, measured vector-index strategy, and repeatable deployment/restore acceptance remain outstanding.

- identify entities and relationships;
- design ownership and deletion behavior;
- plan migrations, constraints, and indexes;
- produce an initial entity-relationship model.

## Phase 3 — Backend and frontend skeleton

Status: Repository scaffolding, shared developer tooling, environment templates, local PostgreSQL/Redis infrastructure, the Express API foundation, the worker entry point, and the React/Vite web entry point are complete. The frontend now has Tailwind CSS semantic tokens, a reusable component layer, a responsive authenticated shell, a centralized credentialed API client, real authentication/session routing, API-backed Dashboard, Documents, Document Details, and Conversations pages, validated PDF upload, safe confirmed document Retry and deletion, a persisted Chat thread and composer, accessible source cards, and a component/service/store test setup. A broader end-to-end browser strategy remains outstanding.

- scaffold the selected repository structure;
- establish TypeScript, linting, formatting, tests, and environment configuration;
- create minimal web, API, and health-check flows;
- prepare local infrastructure without implementing product features.

## Phase 4 — Authentication and authorization

Status: Registration, credential verification, seven-day revocable server-side sessions, HttpOnly cookie transport, PostgreSQL-backed authentication middleware, current-user lookup, authoritative logout, email verification, authentication abuse controls, and ownership authorization are implemented. The web client has matching Login/Register/Verify flows, session restoration, route guards, resend, session-expiration handling, and logout without exposing the opaque credential. Browser CSRF/Origin/header protections, durable quotas/budgets, and PDF containment are also implemented. A public session-management UI and further operational/security acceptance remain outstanding.

- registration and sign-in;
- session lifecycle;
- protected routes and endpoints;
- resource ownership checks;
- relevant security controls and tests.

## Phase 5 — Document upload pipeline

Status: The bounded PDF upload, object-storage persistence, metadata record, duplicate handling, owner-scoped detail/delete/retry operations, and a searchable, status-filtered, paginated list with compact status counts are implemented. List and detail responses use canonical public document field names. The frontend supports upload, safe owner-scoped list/detail views, Failed-only processing Retry, and explicit confirmed deletion from Document Details. Retry preserves the ID, applies the backend-confirmed Processing DTO, and does not poll. An accepted delete navigates away only after the backend hides the document, while permanent storage/chunk/vector cleanup remains asynchronous.

- validate and store a supported file;
- persist document metadata and status;
- return promptly without processing the full document in the request;
- expose clear success and error states.

## Phase 6 — Background processing

Status: The API producers, identifier-only processing/embedding/deletion contracts, three consumers, bounded retry policies, local/R2 file access and cleanup, PDF text extraction, deterministic page-aware chunking, OpenAI embedding abstraction, transactional pgvector persistence, and the full `PENDING`/`PROCESSING`/`CHUNKS_READY`/`EMBEDDING`/`READY` lifecycle are implemented. Retryable attempt failures stay active without a persisted error; `FAILED` is terminal only after automatic attempts are exhausted or an established unrecoverable error occurs. A manual retry fully restarts `FAILED` work through the same pipeline without changing its document ID. Soft-deleted work stops safely and permanent cleanup is idempotent. User-visible processing progress remains outstanding.

- queue processing work;
- extract and split text;
- handle retries, failures, and idempotency;
- expose processing progress to the user.

## Phase 7 — Search

Status: The semantic retrieval foundation is implemented: authenticated queries use the same embedding model as chunks and exact pgvector cosine search over only the owner's non-deleted READY documents. Document-list filename search, status filters, and pagination are already implemented. Extracted-content keyword search, metadata filters, semantic-result pagination, relevance evaluation, thresholds, and a measured vector-index decision remain outstanding.

- metadata and keyword search first;
- database full-text search if justified;
- semantic retrieval only after a measurable baseline exists;
- evaluate relevance using known questions and documents.

## Phase 8 — Grounded AI answers

Status: The backend RAG answer flow and conversation foundation are implemented. Authenticated questions create owner-scoped USER messages, combine up to three recent exchanges from the same conversation with the current question for retrieval understanding, retrieve authorized chunks, construct separated dialogue and labelled document contexts, generate through a shared OpenAI Responses API adapter, and atomically persist the ASSISTANT message with citation snapshots, source-chunk links, and usage metadata. The bounded history has a strict 6,000-character ceiling and is not a factual source or long-term memory. Conversation sidebar data includes a best-effort generated title, latest USER-message preview, and owner-scoped pagination. The frontend has a real paginated Conversations Workspace, explicit creation, durable selected routes, persisted message history, validated duplicate-safe sending, and backend-authoritative source cards. Phase 11.7D is complete: real-provider integration and controlled-browser acceptance cover the grounded path, conversation lifecycle and navigation, citations, insufficient context, owner isolation, delayed route switching, exact content-only message requests, and citation edge cases. Formal citation-quality evaluation and stronger crash recovery remain future work rather than Phase 11.7D acceptance blockers. Streaming, listed as future work at the time of Phase 11.7D, has since shipped: the frontend now calls the Server-Sent Events endpoint (see docs/architecture.md's "Conversation streaming (SSE)" section).

- retrieve authorized passages;
- construct bounded model context;
- generate answers with source references;
- handle insufficient evidence and provider failure;
- add cost and usage safeguards.

## Phase 9 — Caching and performance

- measure before caching;
- choose specific cache targets and invalidation rules;
- inspect database queries and indexes;
- define practical performance expectations.

## Phase 10 — Observability and resilience

- structured logging and request IDs;
- health and readiness checks;
- safe error reporting;
- metrics for requests, jobs, and AI operations;
- failure recovery exercises.

## Phase 11 — Testing and quality review

Status: Complete for the current roadmap scope. Automated web, API, worker, AI, shared-package, lint, format, type-check, and build checks pass. Real local integration covers health, PDF processing, embeddings, grounded multi-turn answers, citations, insufficient context, owner isolation, deletion compatibility, and scoped cleanup. Controlled-browser acceptance covers creation, navigation, persisted refresh, duplicate prevention, delayed route switching, exact message requests, citation rendering and edge cases, responsive behavior, accessibility semantics, and console review.

- unit, integration, and selected end-to-end tests;
- security and ownership scenarios;
- processing failure and retry scenarios;
- accessibility and user-flow review;
- architecture and dependency audit.

## Phase 12 — Product and Liquid Glass polish

Status: Complete and frozen. Phases 12.1, 12.2, 12.2B, 12.2C, 12.2D, 12.3, 12.4, and 12.5 are complete. The approved V3 material direction has centralized
production tokens and shared utilities, the global Sidebar is the signature Navigation Glass
surface, and the real Chat Workspace now applies the material hierarchy across navigation,
selection, reading, citations, and composition. The focused 12.2B pass strengthens the Chat-only
atmosphere and the material separation between Sidebar, rail, shell, solid knowledge, and Composer
without changing the layout or behavior. The 12.2C pass makes that atmosphere slowly shift beneath
the stable glass hierarchy without adding UI motion, network behavior, or new product state. The
12.2D calibration exposes more of that approved environment through the Sidebar and Conversations
rail and removed one redundant Composer pseudo-element layer. Final 12.5 DevTools inspection
proved that the remaining continuous white band came from the outer shell's exposed 8 px padding;
it is now a restrained 1 px material separation while the real input and focus boundaries remain.
The 1024 px Chat compression defect remains resolved through a route-based
single-workspace layout below 1280 px. Dashboard now follows the same product identity while
keeping dense operational information on mostly-solid surfaces and preserving the real API-backed
behavior. Its final controlled responsive and forced-state acceptance passed without a production
change. Documents now establishes the third workspace archetype: an Interaction Glass control bar
over a mostly-solid, dense library that preserves every real Documents contract and state. Document
Details completes the system as a focused inspection/decision workspace with a restrained glass
identity layer, solid factual and lifecycle surfaces, safe Failed recovery, and responsive semantic
ordering. The implemented product identity is codified in `docs/design-manifesto.md`. The next
approved roadmap phase is Phase 13 — Security hardening and OWASP verification.

- refine the approved light-only Liquid Glass Workspace direction without redesigning product flows;
- verify dense-content readability, responsive behavior, interaction states, and accessibility;
- polish only backend-supported states and preserve server-authoritative data;
- record visual QA evidence before broadening scope.

## Phase 13 — Security hardening and OWASP verification

Status: Phase 13A threat modelling, Phase 13B.1 authentication hardening, Phase 13B.2
authorization/owner-isolation verification, Phase 13B.3 resource quotas and AI cost controls,
Phase 13B.4 browser security hardening, and Phase 13B.5.2 PDF containment hardening are complete.
Phase 13B.5.2 added bounded multipart complexity, stored-object size/signature revalidation, a
termination-capable PDF Worker Thread, 150-page/1,000,000-character/1,000-chunk/30-second limits,
and non-retryable containment failures that cannot reach embedding or AI-budget work. Later
subphases still own operational security and production verification.

- review authentication, authorization, cookies, CORS, validation, and error boundaries;
- verify owner isolation and uploaded/retrieved-content trust boundaries;
- test the relevant OWASP web, API, and LLM risks against the implemented product;
- add only evidence-backed controls and regression tests;
- document accepted risks and remaining production requirements.

## Phase 14 — Production readiness, observability, CI/CD, and deployment

Phase 14.2 and Phase 14.3A are complete. The repository includes the Web Docker/Caddy boundary,
same-origin API proxy, Railway-aware API/Worker runtime, fail-fast production validation, private
Redis address-family support, bounded proxy trust, and explicit Prisma build/migration scripts.
Phase 14.3A adds the exact five-service Railway blueprint, PostgreSQL 16 pgvector image/volume plan,
root-context monorepo settings, infrastructure order, complete environment ownership matrix,
deployed proxy-verification procedure, and Phase 14.3B user checklist. Focused React Router and
Nodemailer updates removed both direct runtime audit findings; remaining findings are documented as
unreachable Prisma CLI/tooling dependencies. Phase 14.3B has brought the five Railway services
online and is completing production acceptance. Railway verification email delivery now uses the
existing provider abstraction with Resend HTTPS; optional SMTP remains available outside that
deployment.

## Dark V4 "Liquid Glass" identity and Chat streaming (after Phase 14)

Status: complete. (Numbered as a phase deliberately left open here -- confirm the team's internal phase number before treating this heading as canonical.) The design experiment recorded in `docs/ui-redesign/tasks/UR-001-liquid-glass-foundation` was promoted to production: the dark V4 "Liquid Glass" identity now covers Sign In/Sign Up, the authenticated shell, Overview, Documents, Document Details, and Threads, superseding the light-only visual system described in Phase 12 above. Chat responses stream over Server-Sent Events instead of arriving as a single response (see docs/architecture.md). `/ui-kit` is registered only in development builds.

- automated lint, test, type-check, and build gates;
- structured logs, request/job correlation, metrics, alerts, and failure-recovery exercises;
- container and environment strategy;
- production deployment of web, API, worker, database, storage, and queue;
- migrations, secrets, monitoring, backup, and rollback plan;
- portfolio documentation and demonstration scenario.

## Task workflow inside every phase

```text
Problem
  -> five technology questions
  -> alternatives and trade-offs
  -> decision
  -> small task specification
  -> implementation plan
  -> implementation
  -> manual code review
  -> automated and manual verification
  -> learning note and documentation update
```
