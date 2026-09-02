# Developer Knowledge Hub

Developer Knowledge Hub is a full-stack SaaS platform that helps developers keep technical knowledge in one place and retrieve it with traditional search and AI-assisted answers grounded in their own documents.

## The problem

Developers accumulate README files, PDFs, architecture notes, API specifications, code snippets, meeting notes, and learning material across many tools. Over time, the information becomes difficult to organize, rediscover, and reuse.

## The product

The implemented MVP lets a developer:

- create a private personal knowledge library;
- upload PDFs and search their filenames with status filtering;
- ask questions across their non-deleted, READY personal library;
- receive grounded answers with citation snapshots and Document Details navigation;
- track processing states, restart FAILED documents, and request asynchronous deletion.

Tag management, extracted-content keyword search, selected-document retrieval, and original-PDF
viewing/download remain outside the current implementation.

For a reviewer, start with the two-level [technical documentation](docs/technical-documentation.md)
and its [PDF edition](docs/Developer-Knowledge-Hub-Technical-Documentation.pdf). The
[refresh gap analysis](docs/technical-documentation-gap-analysis.md) records what changed from the
older technical PDF. As of 2026-08-26, the operator confirms the five-service Railway production
path works, including Resend verification, R2 ingestion, embeddings, RAG, citations, and successful
cleanup. This documentation refresh did not repeat production checks or application tests;
phase-specific QA results below are historical snapshots.

## First target user

The first version is designed for an individual software developer. Team collaboration and billing are possible future directions, but they are not part of the initial MVP.

## Project goal

This is both a portfolio product and a structured learning project. Its main engineering goal is to design a production-minded full-stack system in which authentication, file storage, background processing, search, AI, testing, monitoring, and deployment each solve a clear product problem.

## Current status

Product definition and the initial architecture decisions are complete. The repository now contains npm workspaces for the React web application, API, worker, shared contracts, and AI provider integration; shared TypeScript, ESLint, and Prettier configuration; local PostgreSQL and Redis services through Docker Compose; a migrated Prisma schema; an Express API; and separate BullMQ document-processing, embedding, and deletion-cleanup pipelines.

The API package now has its application entry point, environment and Prisma integration, middleware boundaries, revocable server-side sessions, email verification, Redis-backed authentication and expensive-route abuse protection, ownership authorization, protected PDF upload, owner-scoped document list/detail/delete/retry operations, semantic retrieval, and conversation-backed grounded answers. Uploaded PDFs are limited to 10 MiB, checked by MIME type and signature, hashed with SHA-256, stored through an object-storage abstraction, recorded as `PENDING` in PostgreSQL, and submitted to BullMQ using an identifier-only job contract from the shared package. A PostgreSQL-backed ResourceGuard atomically limits each owner to 25 non-deleted documents, 150 MiB of original PDF bytes, two active processing pipelines, and 30 successfully persisted AI answer turns in a rolling 24-hour window. Redis independently limits upload attempts to 20/IP/hour and AI attempts to 60/IP/hour. The worker downloads each PDF, extracts page text, creates ordered chunks, then submits a separate embedding job. The embedding worker calls the shared AI package backed by OpenAI `text-embedding-3-small`, validates 1,536-dimensional vectors, and stores them with model metadata in PostgreSQL pgvector before marking the document `READY`. Every OpenAI question embedding, answer, title, and document-embedding operation is protected by a durable $20 UTC monthly budget reservation and integer-micro-USD usage ledger. Budget-blocked embedding work is delayed while remaining `CHUNKS_READY`; deletion and cleanup stay available. A failed BullMQ attempt is not treated as a failed document: retryable processing stays in an active state without a stored error until the configured attempts are exhausted, while established unrecoverable errors fail immediately with a safe message. An owner can manually restart a terminally `FAILED` document from the beginning under the same document ID; the API removes previous chunk/vector artifacts, moves it to `PROCESSING`, and submits a fresh `document.process` job. Deleting a document sets `deletedAt` immediately, excluding it from list/detail reads and all new semantic retrieval, then submits a `document.delete` job that removes the private object, chunks, embeddings, and database row asynchronously. The API combines the current question with a bounded, owner-scoped window of recent messages to improve follow-up retrieval, embeds that contextual query, retrieves up to five owner-scoped chunks by cosine similarity, builds a source-labelled document context, and calls a provider-neutral answer interface. Conversation history is used only for dialogue understanding; retrieved documents remain the factual source. USER and ASSISTANT messages, citation snapshots, source-chunk relations, and generation usage metadata are persisted in PostgreSQL. After the first successful conversation turn, the existing chat provider is reused best-effort to create a short title; conversation lists are owner-scoped, paginated, and include a bounded preview of the latest USER message. Local development uses a filesystem storage adapter; Cloudflare R2 is the configured production adapter.

The `apps/web` workspace now has a React 19, Vite 8, and TypeScript entry point. Its visual foundation -- now the dark V4 "Liquid Glass" identity across every authenticated page and Auth -- uses Tailwind CSS 4 CSS-first semantic tokens, self-hosted Inter fonts, Lucide icons, reusable typed components, and a responsive authenticated application shell with a desktop sidebar and accessible mobile drawer. A centralized Axios client sends the backend's HttpOnly authentication cookie, normalizes public errors, and supports feature-specific API modules. Zustand manages only the safe current-user DTO and explicit session state; it never receives or stores the opaque session credential. Real Login and Register pages mirror the backend credential rules, `/auth/me` restores sessions after refresh, route guards protect `/dashboard`, `/documents`, `/documents/:documentId`, `/chat`, and `/chat/:conversationId`, and the App Shell exposes the real authenticated identity, email-verification state, resend action, and logout action. `/verify-email` consumes a one-time token from the URL fragment, removes it from browser history, and refreshes authoritative account state after success. `/dashboard` composes the existing document and conversation endpoints, while `/documents` provides a real owner-scoped library with server-side filename search, public status filters, pagination, manual refresh, and validated PDF upload. Its semantic document links open a real owner-scoped details page that safely presents public metadata, grouped lifecycle status, failure information, explicit manual refresh, confirmed Retry for `FAILED` documents, and an owner-scoped Delete flow with accessible confirmation and accurate asynchronous-cleanup feedback. `/chat` provides an owner-scoped Conversations Workspace with URL-backed pagination, explicit server-confirmed creation, direct conversation routes, nullable title/preview fallbacks, stale-response protection, persisted USER/ASSISTANT history, an accessible multiline message composer, and validated source cards for grounded ASSISTANT messages. Successful turns are reloaded authoritatively so server IDs, timestamps, titles, previews, sources, and ordering remain canonical. `/ui-kit` remains the static component showcase. Vitest, React Testing Library, and jsdom cover component, API client, auth service/store, Dashboard, Documents, and Conversations data mapping, request cancellation and stale-response handling, upload validation, Retry/Delete/create/send lifecycles, plain-text message rendering, source validation and navigation, reconciliation, and routing behavior. PDF viewing/download, Markdown rendering, long-term memory, and a public session-management UI are not implemented in the web application yet. Real-time chat streaming (Server-Sent Events) now is: see "Current UI (V4)" below and [docs/architecture.md](docs/architecture.md) for the wire contract.

### Current UI (V4)

The dark "Liquid Glass" V4 visual identity is the shipped product UI, not a preview: it covers
Sign In/Sign Up, the authenticated shell, Overview, Documents, Document Details, and Threads.
"Overview" and "Threads" are the current product-facing terms for what the codebase's routes and
components still internally call Dashboard (`/dashboard`, `DashboardPage`) and Chat (`/chat`,
`ChatPage`) -- both names appear in this document depending on whether the surrounding text is
describing the product (Overview/Threads) or the implementation (Dashboard/Chat). Chat responses
now stream over Server-Sent Events rather than arriving as a single response; see
[docs/architecture.md](docs/architecture.md) for the event contract. `/ui-kit`, the static
component showcase referenced throughout this document, is registered only in development builds
and is not reachable in production.

### PDF containment

Phase 13B.5.2 adds a production-minded PDF containment boundary without changing the processing
lifecycle. Upload parsing accepts one PDF file with no text fields and bounded multipart parts.
The worker revalidates stored byte length and signature, then parses in a termination-capable Node
Worker Thread limited to 150 pages, 1,000,000 extracted characters, 1,000 chunks, and 30 seconds.
Containment failures are safe and non-retryable, and occur before chunk persistence, embedding
jobs, OpenAI calls, or AI-budget reservations.

## Local development

Prerequisites are Node.js with npm, Docker with Docker Compose, installed workspace dependencies,
and a root `.env` based on `.env.example`. The worker validates `OPENAI_API_KEY` at startup, while
the API and worker retain their existing fail-fast checks for other required configuration.

From the repository root, the recommended startup command is:

```bash
npm run dev
```

This starts the existing PostgreSQL and Redis Compose services, waits for both healthchecks to
pass, then runs the Web, API, and Worker development watchers in parallel with `[web]`, `[api]`,
and `[worker]` log prefixes. Pressing `Ctrl+C` stops those local application processes cleanly;
PostgreSQL and Redis intentionally remain available for the next run.

The individual orchestration commands remain useful for debugging:

```bash
npm run dev:infra # Start PostgreSQL and Redis and wait until healthy
npm run dev:apps  # Start Web, API, and Worker; infrastructure must already be running
npm run dev:down  # Stop PostgreSQL and Redis without deleting the persistent volume
```

On first setup, run `npm install` and configure the existing `.env` before starting the stack.
The lower-level workspace commands documented below remain available when only one application
process is needed.

## Web application foundation

The frontend foundation supplies the shared visual language and reusable interaction primitives used by the implemented product pages:

- Tailwind CSS utilities and semantic design tokens are the primary styling system;
- readable solid surfaces sit over a restrained Liquid Glass-inspired background atmosphere;
- the component showcase lives at `/ui-kit`;
- real public authentication routes live at `/login` and `/register`;
- real authenticated Dashboard, Documents library, Document Details, and Conversations Workspace pages live at `/dashboard`, `/documents`, `/documents/:documentId`, `/chat`, and `/chat/:conversationId`;
- selected conversations render persisted USER/ASSISTANT history, accessible backend-authoritative source cards, and a duplicate-safe message composer;
- the shell, Dashboard, Documents library, Document Details, and Conversations Workspace are responsive and use the authenticated user's public profile;
- only the light theme is implemented.

The frontend calls only the Express API. It never accesses PostgreSQL, Redis, object storage, or OpenAI directly.

Frontend source is organized under `apps/web/src`: `components/ui` contains product-neutral typed
primitives, `components/composed` contains document/chat/navigation compositions,
`components/layout` contains the application shell, and `styles/globals.css` owns the Tailwind 4
theme tokens and minimal global defaults. `features/auth` owns authentication types, runtime
validation, the service, Zustand store, route-aware pages, and session UI. `lib/api-client.ts`
centralizes the API base URL, credentials, timeout, supported HTTP methods, and safe error
normalization. `features/dashboard` owns Dashboard response validation, API composition, request
lifecycle, section states, and route-level presentation. `features/documents` owns the document
list, upload, detail, Retry, and deletion contracts; server-state lifecycle; filters; pagination;
upload UI; and route-level detail presentation.
`features/conversations` owns shared conversation and message runtime schemas and DTOs,
list/create/detail/send API calls, URL-backed pagination, cancellable read lifecycles,
non-aborted duplicate-safe mutations, direct-route validation, authoritative thread refresh,
failure reconciliation, validated ASSISTANT source presentation, and the responsive Conversations Workspace. Dashboard recent
conversations reuse that public list contract and link to the selected conversation route.

### Dashboard

The authenticated Dashboard composes existing owner-scoped APIs rather than introducing a
Dashboard-specific backend contract:

- `GET /api/documents?page=1&limit=5` supplies recent documents and aggregate status counts;
- `GET /api/conversations?page=1&limit=5` supplies recent conversations;
- `GET /api/documents?status=FAILED&page=1&limit=3` supplies documents requiring attention.

The three requests start independently and can succeed or fail independently. Each affected
section has its own loading, safe error, and retry state, so a conversation failure does not hide
document data and vice versa. Requests are cancelled when the page unmounts, repeated retry clicks
do not create duplicate in-flight requests, and the page does not poll.

The UI maps `READY` to Ready, `FAILED` to Failed, and `PENDING`, `PROCESSING`, `CHUNKS_READY`, and
`EMBEDDING` to one public Processing state. It provides a first-document onboarding state for a new
knowledge base, compact mobile cards instead of desktop tables, safe truncation for long content,
and semantic navigation links to the real Documents and Conversations pages. Activity timelines,
progress percentages, charts, billing data, direct document retry/delete, downloads, sharing, and
fake conversation actions are intentionally excluded because the current Dashboard APIs do not
support them.

### Documents library

The authenticated Documents page uses `GET /api/documents` with a page size of 20. Filename search
is trimmed, debounced by 350 ms, and executed by the backend rather than filtering one browser
page. `ALL`, `READY`, `PROCESSING`, and `FAILED` use the backend's public grouped status contract;
changing search or status resets the page to one, while pagination retains both. Requests are
cancelled when a newer query replaces them, and a request identifier prevents stale responses
from replacing newer results.

PDF upload uses `POST /api/documents` with one browser-created `FormData` field named `file`.
The modal supports an accessible picker and drag-and-drop, preserves a selected valid file after
recoverable upload errors, prevents duplicate submission, and validates the MIME type, non-empty
size, and 10 MiB limit before submission. The backend remains authoritative and additionally
validates the PDF signature. `DUPLICATE_DOCUMENT` becomes a safe conflict message without exposing
the file hash or database constraint. Successful upload closes and resets the modal, displays a
toast that says processing has started, and refreshes the active query without changing the
user's current filter.

There is no polling: lifecycle changes appear after manual refresh, another query change,
navigation return, or a later product-specific real-time decision. Retry, list-row or bulk Delete,
original-file viewing/download, sharing, worker stages, and exact progress remain excluded even
though some corresponding backend capabilities already exist.

### Document details

Each semantic filename link in the Documents library opens the protected
`/documents/:documentId` route. The page calls `GET /api/documents/:documentId` through the shared
credentialed client and validates the explicit public DTO before display. It shows only the file
name, human-readable type, public MIME type, size, public grouped status, added/updated/processed
dates, and a safe processing error for a failed document.

The details hook validates the route parameter against the backend's identifier rules, cancels
replaced requests, ignores stale responses, and prevents duplicate refreshes. Manual Refresh
keeps successfully loaded information visible while a new request is active and scopes a
recoverable refresh error to the page. It does not poll or claim live progress.

Missing, foreign-owned, and soft-deleted documents all render the same generic
`Document not found` state because the backend intentionally returns the same
`DOCUMENT_NOT_FOUND` contract. The frontend does not infer or disclose ownership.

A successfully loaded Ready, Processing, or Failed document has a restrained `Document management`
section near the bottom of the page. `Delete document` opens an accessible destructive
confirmation dialog; opening or cancelling it sends no request. Confirmation sends exactly one
credentialed `DELETE /api/documents/:documentId` request and does not optimistically remove the
page. While the request is active, dialog dismissal, duplicate confirmation, and manual Refresh
are disabled. A successful `202 Accepted` response replaces navigation history with `/documents`
and announces that the document is unavailable immediately while final cleanup continues in the
background. The remounted Documents page fetches current owner-scoped data, which excludes the
soft-deleted document.

Safe recoverable errors keep the loaded details and dialog visible for an explicit retry. A
`DOCUMENT_NOT_FOUND` race navigates back with neutral `Document unavailable` feedback and does not
claim that the current request performed deletion. Confirmed `UNAUTHENTICATED` errors continue
through the centralized session-expiration path. Undo, Trash, Restore, cleanup polling, manual
original-file access, PDF viewing, sharing, and selected-document Chat actions remain intentionally
excluded.

Only a public Failed document renders a separate `Retry processing` recovery section. Opening or
cancelling its accessible dialog sends no request. Confirmation sends exactly one credentialed
`POST /api/documents/:documentId/retry` request and retains the Failed state until the backend
accepts it. The `202 Accepted` response supplies the complete public Details DTO for the same
document ID, now in Processing with `processingError` and `processedAt` cleared. The page applies
that server-confirmed DTO without changing routes, hides Retry, removes stale failure text, keeps
Delete and manual Refresh available, and announces that processing restarted. It does not poll.

Retry, Delete, and manual Refresh are locally coordinated so their state-changing requests cannot
overlap. A retryable queue/server error preserves the Failed document and dialog for another
explicit attempt. `DOCUMENT_NOT_FOUND` uses the same neutral unavailable navigation as Delete.
`INVALID_DOCUMENT_STATE` closes the stale confirmation, requests one current Details refresh, and
shows neutral status-changed feedback. `PROCESSING_QUEUE_UNAVAILABLE` is mapped to a safe message;
confirmed `UNAUTHENTICATED` continues through the centralized session-expiration flow.

For local verification, run `npm run dev`; sign in, open `/documents`, follow a document filename
link, and confirm that a direct browser refresh
on `/documents/:documentId` reloads the same owner-scoped DTO. Use the page's Refresh control to
check a changed processing state. Open Delete and Cancel to verify no change, then confirm deletion
and verify navigation to a freshly loaded `/documents` list and generic not-found behavior on the
old details URL. The `202` response verifies deletion acceptance and immediate invisibility; run
the deletion worker separately before claiming physical object/chunk/vector cleanup. No OpenAI
call is required for a `PENDING` fixture.

To verify Retry without OpenAI, prepare an owner-scoped Failed fixture with a safe
`processingError`, open its Details route, cancel once, then confirm Retry. Verify a `202` response,
the unchanged ID, Processing state, cleared failure fields, one identifier-only processing job,
and removal of stale chunks. Do not start the processing worker merely to force Ready. Remove the
fixture and its targeted job afterward.

The conversation repository integration test controls the timestamps of every same-conversation
message participating in its exact context-order assertion. This prevents the real current clock
from making earlier setup messages newer than the fixed context fixtures; production ordering
remains `createdAt` with the existing deterministic ID tie-breaker.

### Frontend authentication

The web client uses a backend-managed opaque session credential only through an HttpOnly cookie.
Local HTTP development uses `developer_knowledge_hub_session`; production uses the Secure,
host-only `__Host-developer-knowledge-hub-session` cookie. JavaScript cannot read either cookie,
and no authentication credential is stored in Zustand, localStorage, sessionStorage, or URLs.
PostgreSQL stores only SHA-256 session-token hashes. Sessions have a fixed seven-day lifetime,
do not slide, and are checked in PostgreSQL on every authenticated request.

Unsafe browser requests must carry the exact configured Origin. Authenticated mutations also use a
session-bound `X-CSRF-Token` obtained after Login or session restoration and retained only in
frontend memory. Origin and CSRF checks run before rate limits, multipart buffering, or business
logic. Auth, document, conversation, and search responses are marked `private, no-store`, and the
API plus production-preview frontend emit CSP, frame, MIME-sniffing, referrer, and permissions
protections. HSTS is enabled only for validated HTTPS production configuration. Production requires
an explicit HTTPS `CORS_ORIGIN` and a CSRF secret of at least 32 characters.

At application startup, the auth store moves from `idle` to `checking` and calls
`GET /api/auth/me`. It then becomes `authenticated`, `unauthenticated`, or `unavailable` when the
session cannot be checked because the service is unreachable. Protected content is not rendered
before this check completes. A confirmed public `UNAUTHENTICATED` API response emits a centralized
session-expiration event, clears the current user, and lets the route guard return the visitor to
Login. Network failures remain distinct from invalid credentials.

Registration calls `POST /api/auth/register` and receives the same generic accepted response for a
new or existing email. A new account starts unverified, receives a 60-minute single-use email link,
and is returned to Login without a session. Login creates a new independent server-side session.
An unverified user may access `/me`, logout, view existing owner-scoped data, and request a new
verification link, but backend middleware blocks document upload/retry, semantic search, and AI
message generation. Verification updates are visible to an existing session without another
login. Logout revokes only the current PostgreSQL session before clearing its cookie; an internal
service operation can revoke every session for a user.

Local development defaults `EMAIL_DELIVERY_DRIVER=console`. The API prints the verification URL
only in non-production mode. Railway production uses `EMAIL_DELIVERY_DRIVER=resend` and sends
through Resend's HTTPS API using the API-only `RESEND_API_KEY` and configurable `EMAIL_FROM`.
Optional SMTP remains available for local or alternate environments, but its variables are not
required when the Resend driver is selected. Verification-link hosts always come from the explicit
`APP_BASE_URL`, never from request headers. `onboarding@resend.dev` is suitable only for the initial
account-owner smoke test; public external-user delivery requires a verified Resend domain and an
updated sender address.

For local development, copy the frontend example when a custom API location is needed:

```bash
cp apps/web/.env.example apps/web/.env
```

`VITE_API_BASE_URL` is public browser configuration and must never contain secrets. Left unset (the local default), the client calls the API same-origin at `/api`, and the Vite dev server's own proxy forwards those requests to the local API at `http://localhost:3000` -- mirroring the same-origin topology production uses behind Caddy. Set it explicitly only to point the web client at a different origin (for example a remote API).

Production uses a same-origin Web gateway: Caddy serves the compiled React application and proxies
`/api/*` to the private API without rewriting the path. Phase 14.3A now documents the exact Railway
service blueprint, root-context workspace builds, PostgreSQL 16 pgvector plan, private networking,
environment ownership, infrastructure order, proxy-trust acceptance, and user actions for the first
real environment. It also removed the direct React Router and Nodemailer audit findings through
focused version updates; the remaining audit nodes are documented Prisma CLI/tooling dependencies.
See [`docs/deployment.md`](docs/deployment.md). The five Railway services are now online and
Phase 14.3B production acceptance is in progress; verification mail now uses Resend HTTPS because
Railway SMTP egress is not available for this deployment tier.

From the repository root:

```bash
npm run dev:web
npm run preview:web
npm run typecheck:web
npm run test:web
npm run lint:web
npm run build:web
npm run format:check --workspace @developer-knowledge-hub/web
```

After starting the development server, open `/ui-kit` to review the complete component and state
showcase. The route is a development aid and is not part of the primary product navigation.

## Document API

All document endpoints require the opaque HttpOnly session cookie. Upload and Retry additionally
require a verified email address.

- `POST /api/documents` uploads one validated PDF.
- `GET /api/documents` returns an owner-scoped, searchable, status-filtered, paginated document list with status counts.
- `GET /api/documents/:documentId` returns one owner-scoped document detail DTO for direct page loading.
- `POST /api/documents/:documentId/retry` fully restarts one active, owner-scoped `FAILED` document and accepts asynchronous processing.
- `DELETE /api/documents/:documentId` soft deletes an owned document and accepts asynchronous permanent cleanup.

The list accepts `page`, `limit`, `search`, and `status`. Defaults are page `1`, limit `10`, and status `ALL`; the maximum limit is `100`. Search matches only filenames and is case-insensitive. The public `PROCESSING` filter groups `PENDING`, `PROCESSING`, `CHUNKS_READY`, and `EMBEDDING` records. List items use the canonical fields `id`, `filename`, `mimeType`, `size`, `processingState`, `createdAt`, `updatedAt`, and `processedAt`.

The detail response adds `processingError`, which is returned only for a `FAILED` document. Missing and foreign-owned identifiers use the same `DOCUMENT_NOT_FOUND` response so ownership cannot be inferred. Full document contracts and pagination semantics are documented in [`docs/api.md`](docs/api.md).

Manual retry keeps the same document ID, filename, owner, and stored source file. It does not resume from the failed stage: previous chunks and vectors are removed transactionally, state becomes `PROCESSING`, and the existing worker pipeline starts again from PDF retrieval. A second retry is rejected after the first request changes the state.

Soft-deleted documents use the same not-found behavior and are excluded from list totals, status counts, semantic search, and RAG context. A successful delete returns `202 Accepted`; permanent storage and database cleanup continues through BullMQ.

## Conversation API

All conversation endpoints require the opaque HttpOnly session cookie. AI-backed message creation additionally requires a verified email address. `POST /api/conversations` accepts no client data and returns the server-created record with `201 Created`. `GET /api/conversations` accepts `page` and `limit`, defaults to page `1` and limit `20`, and returns at most `100` conversations per page. Items are ordered by `updatedAt DESC`, then `id DESC`, and contain `id`, generated `title`, latest USER-message `preview`, `createdAt`, and `updatedAt`. A new conversation may temporarily have `title: null` and `preview: null` until its first successful turn. `GET /api/conversations/:conversationId` validates a direct owner-scoped route and returns public metadata plus its persisted public messages.

The frontend uses `/chat` for the paginated conversations list and `/chat/:conversationId` for a
durable selection. Visiting `/chat` never creates a record. `New conversation` waits for the real
POST response, retains the backend ID, navigates to page one, and performs one controlled list
refresh without an optimistic row. A nullable title is displayed as `New conversation`; a nullable
latest-USER preview is displayed as `No messages yet`. Missing, foreign-owned, and soft-deleted
selections share one `Conversation unavailable` state. On desktop the feature shows a local list
panel beside an opaque selected workspace; tablet and mobile use route-based single-panel
navigation. The selected route renders messages in the backend's chronological order and sends
only the new, trimmed `content` value. USER and ASSISTANT content is rendered as selectable plain
text with preserved line breaks; HTML, Markdown, URLs, message IDs, AI metadata, and internal source
fields are never interpreted as message presentation. The composer uses Enter to send, Shift+Enter for a newline,
is IME-safe, and enforces the backend's 4,000-character limit.

The message response contains the persisted ASSISTANT message and safe sources, but not the USER
message or updated conversation. After `201 Created`, the frontend performs one forced detail read
and one page-one list refresh rather than inventing IDs, timestamps, title, preview, or ordering.
The same forced read reconciles ambiguous failures because the backend saves USER first and then
best-effort removes it if retrieval, generation, or ASSISTANT persistence fails. A confirmed new
USER message clears the matching draft to avoid an unsafe duplicate; otherwise the draft remains
available for an explicit retry. Navigation never aborts or repeats the active POST, and a response
for conversation A cannot update conversation B.

`POST /api/conversations/:conversationId/messages` uses at most the six most recent prior USER/ASSISTANT messages from that active, owner-scoped conversation, with a strict serialized limit of 6,000 characters. Newer messages win when either limit is exceeded. This context helps resolve follow-up references but is not long-term memory and is never loaded from another conversation or user. The answer must still be grounded in the retrieved document chunks.

Phase 11.7C renders each persisted ASSISTANT message's validated `sources` array in backend order.
Each accessible card displays the contract label once as `[S#]`, the server-provided document name,
and `Page N` only when `page` is present. Cards navigate through React Router to the encoded
`/documents/:documentId` route. Duplicate sources are preserved, USER messages never render source
cards, and `chunkId` and `chunkPosition` remain validated but hidden. The source link opens Document
Details only; PDF viewing, download, and deep page anchors are not implied. Streaming, polling,
WebSockets, Markdown, regeneration, message editing, and Chat attachments remain intentionally
excluded.

The Phase 11.7D local integration run verified the complete API-to-worker RAG path with the real
local PostgreSQL, Redis, object-storage, pgvector, and configured OpenAI adapters. A PDF moved to
`READY` with a persisted 1,536-dimensional embedding; an authenticated conversation produced
grounded multi-turn answers with persisted `[S1]` citations, generated title and latest-USER
preview; an unrelated question returned the canonical insufficient-context answer without
sources; and a second user could not read or retrieve the first user's document or conversation.
Historical citation snapshots remained available after asynchronous source deletion while the
referenced Document Details endpoint returned its generic not-found response. The same run
confirmed that answer prompts require plain text and that focused QA users, documents, chunks,
conversations, messages, storage objects, and queue jobs can be removed without broad cleanup.

Phase 11.7D is **complete**. Controlled Codex in-app browser acceptance now covers explicit
server-confirmed conversation creation, a first message and follow-up, authoritative refresh,
Browser Back and Forward, and a delayed message POST followed by an in-app route switch without
duplicate persistence or cross-conversation state leakage. Two isolated QA users received the same
generic unavailable UI for each other's document and conversation URLs without leaking names,
titles, messages, or citation metadata.

A temporary local QA proxy confirmed that every successful message request used exactly one
`POST /api/conversations/:conversationId/messages`, included the existing authentication cookie,
and sent only `{ "content": "..." }`; it sent no history, citations, source or owner IDs, model
configuration, or timestamps. Citation edge-case acceptance also passed at 390 × 844: `page: null`
omitted page text, a long HTML-looking filename remained plain text, the source link retained its
complete accessible name, and the page had no horizontal overflow or injected script element.
The browser console remained free of warnings and errors. The final acceptance found no new
production defect, so no application code or backend contract changed.

Phase 12.1 is **complete**. The frontend now has a centralized V3-inspired material system with a
restrained atmospheric canvas; distinct Navigation Glass, Workspace Glass, Solid Knowledge, and
Elevated Interaction roles; localized environment-reactive edges; three elevation levels; and a
signature global Sidebar. Typography utilities now control only type metrics, while semantic
foreground utilities independently protect Button and status contrast. Primary, destructive,
Ready, Processing, Failed, and Info text all meet WCAG AA in the implemented combinations. Shared
focus, reduced-motion, and opaque no-backdrop-filter behavior remain part of the foundation, and
the UI Kit demonstrates the production vocabulary.

Phase 12.2 is **complete**. The real Chat Workspace now follows the approved V3 composition using
the shared Phase 12.1 material system: Workspace Glass for the Conversations rail and workspace
chrome, the Liquid selected-state language for the active conversation, secondary USER messages,
Solid Knowledge surfaces for grounded ASSISTANT answers, stacked evidence-oriented citations, and
Elevated Interaction Glass for the floating Composer. The desktop split begins at 1280 px; at 1024
px and below the selected route uses the available width instead of compressing the thread into a
third narrow column. Controlled browser QA passed at 1440 × 900, 1280 × 800, 1024 × 768, 768 ×
1024, and 390 × 844 without horizontal overflow or React console warnings. These are historical
Phase 12.2 results; Dashboard and the remaining Phase 12 polish subsequently completed as recorded below.

Phase 12.2B is **complete**. The Chat route now expresses the V3 product identity more clearly
without changing its layout or behavior: a slightly stronger localized atmospheric canvas gives
the Sidebar, Conversations rail, workspace shell, header, and Composer meaningful environmental
light to react to; their opacity relationships and restrained elevation now separate Navigation,
Workspace, Solid Knowledge, and Interaction materials. Edge response is short, asymmetric, and
localized rather than a continuous gradient border. ASSISTANT answers and citations remain solid,
calm evidence surfaces. Controlled QA passed at 1440 × 900, 1280 × 800, 1024 × 768, and 390 × 844,
including a forced no-backdrop-filter render, focus and semantic checks, and a clean React console.

Phase 12.2C is **complete**. Chat now has one route-scoped ambient layer with exactly three diffuse
light fields moving beneath the existing material hierarchy on independent 34–43 second,
transform-only cycles. The UI itself does not move: ASSISTANT answers, citations, USER messages,
the textarea plane, and primary actions remain stable and readable. Supported browsers receive
small, conservative Sidebar, Conversations, shell, and Composer translucency adjustments; mobile
uses lower ambient intensity and more opaque content chrome. Reduced-motion preferences retain the
atmosphere without animation, and browsers without backdrop filtering retain the established
opaque fallbacks. Controlled QA covered immediate and time-shifted 1440 × 900 renders, 1280 × 800,
1024 × 768, and 390 × 844 without horizontal overflow, plus focus, semantics, fallback, console,
and the full frontend regression suite. No backend contract, product behavior, dependency, or
network-capable code changed.

Phase 12.2D is **complete**. The Chat Sidebar and Conversations rail now transmit the approved
Living Glass environment more clearly while preserving their Navigation-versus-Workspace
hierarchy, opaque fallbacks, mobile readability, and unchanged ambient motion. The Composer keeps
its real input boundary and visible focus state, but no longer draws the redundant always-visible
optical-thickness layer from its outer-shell pseudo-element. Final Phase 12.5 DevTools inspection
later identified and removed the remaining continuous band caused by the shell's exposed padding.
Controlled browser QA covered staged
1440 × 900 comparison, 1280 × 800, 1024 × 768, and 390 × 844 layouts, a 15-second motion sample,
forced reduced motion and no-backdrop-filter paths, and a clean React console. No layout, product
behavior, backend contract, dependency, or ambient-field definition changed.

Phase 12.3 Dashboard V3 is **complete**. The existing owner-scoped Dashboard data flow is unchanged,
while Dashboard now shares
the approved Chat ambient canvas and Navigation Glass identity. Upload and New chat use restrained
Interaction Glass in one indigo product family; real document metrics use mostly-solid semantic
surfaces; and Recent documents, Recent conversations, and Documents requiring attention remain
stable Solid Knowledge panels. The mockup's information order was retained, while its fake global
search, decorative artwork, green secondary branding, inline Retry, row menus, progress values,
activity, and glow-heavy treatment were intentionally excluded. Controlled 1440 × 900 browser QA
passed for populated and empty states, long and HTML-looking plain text, real navigation, focus,
overflow, and console behavior. Final standalone browser acceptance also passed at 1280 × 800,
1024 × 768, and 390 × 844, including controlled loading and error states, reduced-motion behavior,
and an opaque no-backdrop-filter fallback. No acceptance-breaking defect was found. The full
290-test frontend regression, TypeScript, ESLint, Prettier, and production build pass; Playwright
was used only as a one-time QA runtime and was not added to project dependencies.

Phase 12.4 Documents Library V3 is **complete**. The real owner-scoped Documents behavior remains
the authority for search, processing-status filters and counts, refresh, upload, navigation,
pagination, loading, errors, and semantically different empty states. The exact `/documents` route
now shares the approved Living Glass environment and global Navigation Glass Sidebar with Chat and
Dashboard. Search and filters occupy one restrained Interaction Glass control surface, while the
document collection remains a mostly opaque Solid Management surface with compact semantic rows.
Desktop uses a full information grid from 1280 px; narrower layouts switch to a readable document
list instead of compressing the table. Controlled browser QA passed at 1440 × 900, 1280 × 800,
1024 × 768, and 390 × 844 without horizontal overflow, including long and HTML-looking filenames,
pagination, zero/one/many document states, loading, error recovery, keyboard focus, reduced motion,
and an opaque no-backdrop-filter fallback. Network QA recorded exactly one real Documents request
for initial load, debounced search, filtering, and refresh. The full 291-test frontend regression,
TypeScript, ESLint, Prettier, and production build pass; standalone Playwright was used only for the
explicitly approved final QA and was not added to project dependencies.

Phase 12.5 and the final Phase 12 product acceptance are **complete**. The real protected
`/documents/:documentId` route now shares the approved Living Glass environment and presents a
focused inspection/lifecycle workspace. Document identity and Refresh use restrained Interaction
Glass; document information, lifecycle, Failed recovery, and management use stable Solid
Knowledge/Decision surfaces. The frontend still groups `PENDING`, `PROCESSING`, `CHUNKS_READY`, and
`EMBEDDING` as one truthful Processing experience, exposes Retry only for Failed, and preserves the
existing owner-scoped Refresh/Delete/Retry contracts. Mobile presents lifecycle and recovery before
dense metadata, long or HTML-looking filenames remain inert and bounded, and no unsupported action
or fake progress was added. Final controlled and one-time standalone browser acceptance covered 35
product-wide scenarios, five Details viewports, lifecycle and forced states, dialogs, mobile
navigation, reduced motion, opaque fallback, clean React behavior, and one-request-per-action
network behavior. The Composer's remaining 8 px exposed glass band was reduced to a 1 px material
separation without removing its real input border or focus treatment. All 292 frontend tests and
the required TypeScript, ESLint, Prettier, and production-build checks pass. Phase 12 is now frozen;
the implemented identity is recorded in [`docs/design-manifesto.md`](docs/design-manifesto.md).

See:

- [`docs/product-scope.md`](docs/product-scope.md)
- [`docs/architecture.md`](docs/architecture.md)
- [`docs/api.md`](docs/api.md)
- [`docs/security.md`](docs/security.md)
- [`docs/roadmap.md`](docs/roadmap.md)
- [`docs/design-manifesto.md`](docs/design-manifesto.md)
- [`docs/decisions/`](docs/decisions/)
