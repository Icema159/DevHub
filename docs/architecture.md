# Approved architecture

## Status

The initial high-level architecture was approved during Phase 1. It defines the current component boundaries and technology direction for implementation. It is not immutable: changes must be justified by product evidence and recorded in an Architecture Decision Record (ADR).

The implementation foundation now includes npm workspaces, shared TypeScript and code-quality configuration, a React 19 and Vite 8 web entry point, local PostgreSQL and Redis services through Docker Compose, applied Prisma migrations, generated Prisma Client, and an Express API with revocable server-side sessions, email verification, authentication abuse protection, authorization, PDF upload, owner-scoped document listing/detail/deletion, semantic retrieval, conversations, and grounded answer generation. Original files are stored through an object-storage abstraction, with local filesystem and Cloudflare R2 S3-compatible adapters available to both the API and worker for write, read, and cleanup responsibilities. The API submits identifier-only document jobs to BullMQ. The worker extracts and chunks PDFs, submits a separate embedding job, calls OpenAI through a shared embedding abstraction, and stores validated 1,536-dimensional vectors in pgvector before marking the document `READY`. Documents move through `PENDING` → `PROCESSING` → `CHUNKS_READY` → `EMBEDDING` → `READY`, or to `FAILED` with a safe processing error. Soft deletion immediately hides a document and blocks retrieval; a separate cleanup job removes storage and database data permanently. Authenticated follow-up questions combine a bounded, current-conversation history with the current question for retrieval, then retrieve up to five owner-scoped, non-deleted `READY` document chunks by cosine similarity. The answer prompt receives dialogue history separately from the labelled document context, and the document chunks remain the only factual source. Both messages, citations, and generation metadata are persisted. Conversation lists are owner-scoped and paginated, include the latest USER-message preview, and receive a short best-effort generated title after their first successful turn. The web workspace provides a light-only Tailwind CSS design system, responsive authenticated shell, centralized Axios API client, real credential forms, HttpOnly-cookie session restoration, verification-required/resend/result UX, protected routing, safe session-expiration handling, an API-backed Dashboard, an owner-scoped Documents library with validated PDF upload, a real owner-scoped Document Details page with safe confirmed Retry and deletion, and a responsive Conversations Workspace with explicit creation, durable selected routes, persisted message sending, and accessible backend-authoritative source cards. The UI component showcase remains available. PDF viewing/download, a public session-management UI, streaming, and long-term memory remain outstanding.

Phase 13B.5.2 adds a containment boundary inside the existing worker architecture: stored PDFs are
revalidated, parsed in a termination-capable Node Worker Thread, and checked against centralized
page, extracted-text, chunk, and time limits before the embedding queue can be reached.

## Technology overview

| Responsibility        | Approved technology                                     |
| --------------------- | ------------------------------------------------------- |
| Frontend              | React 19 + Vite 8 + TypeScript web application          |
| HTTP backend          | Express API                                             |
| Database              | PostgreSQL with Prisma ORM                              |
| Original file storage | Object storage abstraction with Cloudflare R2 initially |
| Background job queue  | Redis with BullMQ                                       |
| Background processing | Node.js worker                                          |
| AI capabilities       | AI provider abstraction with OpenAI initially           |
| Vector search         | PostgreSQL with pgvector                                |
| Repository            | Monorepo with npm workspaces                            |

## Production deployment boundary

Phase 14.2 defines a same-origin production topology without changing application contracts. A
public Caddy Web service serves the compiled React application and proxies `/api/*`, with the
original URI intact, to a private Express API service. The Worker is private and independently
consumes the three existing BullMQ queues. API and Worker share private pgvector-enabled PostgreSQL,
private Redis, R2, and provider configuration; only the API runs `prisma migrate deploy`.

Production environment builders reject localhost service fallbacks, local object storage, missing
R2/OpenAI configuration, incompatible public origins, and an unspecified proxy-trust policy. Redis
connections allow either IP family for private DNS. Express uses a small explicit trusted-hop count,
never unrestricted forwarded-header trust. The real Railway hop count, database extension, service
health, secrets, and smoke tests remain deployment-time checks in Phase 14.3. See
[`deployment.md`](deployment.md).

## High-level flow

```text
Browser
  |
  v
React web application
  |
  v
Express API ----------------------> PostgreSQL + Prisma
  |                                  |
  |                                  +-- users and authentication data
  |                                  +-- users and user-owned documents
  |                                  +-- processing state
  |                                  +-- conversations and messages
  |                                  +-- extracted chunks and source references
  |                                  +-- embeddings searched with pgvector
  |
  +-------------------------------> Object storage interface
  |                                  |
  |                                  +-- Cloudflare R2
  |                                  +-- private original files
  |
  +-------------------------------> Redis + BullMQ
                                         |
                                         v
                                  Node.js background worker
                                         |
                                         +-- read original file
                                         +-- extract text
                                         +-- split content
                                         +-- request embeddings
                                         +-- store chunks and embeddings
                                         +-- update processing state
```

### Upload and processing flow

The current upload foundation works as follows:

1. An authenticated client submits one PDF through API-proxied `multipart/form-data`.
2. The API accepts one file with no text fields and bounded multipart parts, limits the file to 10 MiB, and validates its MIME type, PDF signature, name, and ownership context.
3. The document service calculates a lowercase hexadecimal SHA-256 hash and rejects a duplicate owned by the same user.
4. The original file is stored through the object-storage interface. Local development uses the filesystem adapter; configured production environments use Cloudflare R2.
5. The API stores owner-scoped metadata in PostgreSQL with `PENDING` status.
6. The API submits a `document.process` BullMQ job whose payload contains only `documentId` and `userId`, then returns without parsing the PDF.
7. The worker reloads the document from PostgreSQL, verifies its identity, owner, MIME type, and state, and atomically transitions `PENDING` work to `PROCESSING`, clearing any stale processing error. Later automatic attempts resume from the active state.
8. The worker requests the original PDF through its read-only object-storage interface. The local adapter checks file metadata and the R2 adapter checks `ContentLength` against authoritative stored size before buffering; both verify the final byte count. The processing service checks the PDF signature again before parsing.
9. A dedicated Node Worker Thread runs the `pdf-parse` adapter with bounded heap/stack resources. It extracts pages incrementally, rejects more than 150 pages or 1,000,000 extracted characters, and is forcibly terminated after 30 seconds. A parser crash remains isolated from the BullMQ process and its other consumers.
10. A deterministic page-aware chunker normalizes whitespace and creates ordered, non-empty chunks of at most 1,200 characters, with no more than 1,000 chunks per document. Chunk metadata records the source page, character count, and the method used for the current approximate token count.
11. One PostgreSQL transaction deletes any previous chunks, inserts the replacement set, and changes the document to `CHUNKS_READY`. This prevents duplicate chunks on retries.
12. The document worker submits a separate `document.embed` job containing only `documentId` and `userId`. If enqueue fails, the document remains `CHUNKS_READY`, and the processing-job retry repeats only the enqueue operation.
13. The embedding consumer verifies ownership and state, loads chunks in position order, and reserves the worst-case provider cost from the global PostgreSQL budget before moving the document to `EMBEDDING`. Budget denial leaves the document `CHUNKS_READY` and delays the same BullMQ job without consuming a failed attempt. After admission it clears stale processing errors and generates embeddings in bounded batches through the application-owned embedding service. Later provider attempts resume from `EMBEDDING`.
14. OpenAI is the initial provider. `text-embedding-3-small` is requested with 1,536 dimensions, and every returned vector is checked for length and finite numeric values.
15. A PostgreSQL transaction writes pgvector values with `embeddingModel` and `embeddingDimensions`, verifies every chunk has the expected embedding, and changes the document to `READY`. Existing matching embeddings are skipped on retry, while vector writes overwrite the single column rather than creating duplicate rows.
16. A retryable processing or embedding attempt throws back to BullMQ but leaves the document active with `processingError = null`. Only the last configured automatic attempt moves the document to `FAILED`, stores a bounded safe error, and keeps `processedAt` null. Established deterministic parsing and invalid-business-state failures are unrecoverable and may move directly to `FAILED` without consuming the remaining attempts. The processor still throws every error so BullMQ records the job outcome.
17. PDF page, text, chunk, timeout, parser-crash, and stored-file validation failures are non-retryable. They move the document directly to `FAILED` with a safe message and cannot create chunks, an embedding job, an OpenAI call, or an AI-budget reservation.
18. If storage succeeds but database persistence fails, the API makes a best-effort deletion of the uploaded object. If initial queue submission fails, it removes only a still-`PENDING` record before deleting the object, avoiding cleanup after processing has begun. The database uniqueness constraint handles concurrent duplicate uploads.

All three BullMQ queues currently allow three total attempts with exponential backoff. Processing and embedding workers determine terminal failure from each job's actual `attempts` option rather than a duplicated retry constant. Invalid job contracts, ownership mismatches, unsupported states, and deterministic PDF parsing failures are non-retryable; a missing document is an idempotent no-op for stale processing, embedding, or cleanup work. A transactional outbox can replace best-effort queue compensation if stronger PostgreSQL-to-Redis delivery guarantees become necessary.

### Manual document retry flow

1. An authenticated `POST /api/documents/:documentId/retry` requests a full restart for one owner-scoped, non-deleted document.
2. A PostgreSQL transaction accepts only `FAILED`, changes it to `PROCESSING`, clears `processingError` and `processedAt`, and deletes old chunks. Embeddings live on chunk rows, so they are removed in the same transaction.
3. The API submits a fresh `document.process` job with only `documentId` and `userId`. A unique manual-retry job ID avoids collision with the completed initial-upload job retained by BullMQ.
4. The existing worker continues from `PROCESSING`, downloads the unchanged source object, parses and replaces chunks, queues embeddings, and reaches `READY` or the existing terminal `FAILED` path.
5. The state transition is the duplicate-request guard: once one request moves the document to `PROCESSING`, further retry requests return `INVALID_DOCUMENT_STATE`.
6. If queue submission fails, the API conditionally restores the exact retry transition to its prior `FAILED` metadata and returns a safe `503`. PostgreSQL and Redis are not atomically coordinated; a transactional outbox remains the future option for eliminating the small ambiguous-delivery window.
7. Every transition requires `deletedAt IS NULL`, and the existing worker stops safely if deletion wins a later race.

### Document deletion flow

1. An authenticated `DELETE /api/documents/:documentId` performs one owner-scoped update requiring `deletedAt IS NULL`.
2. Setting `deletedAt` hides the document from list/detail queries and excludes it from pgvector retrieval immediately.
3. The API submits an identifier-only `document.delete` job. If enqueue fails, it compensates by clearing only the exact timestamp written by that request and returns a safe `503`.
4. The cleanup worker reloads only a matching soft-deleted document, deletes its private local/R2 object, then transactionally deletes chunks (including vectors and live source links) followed by the document row.
5. Missing objects, chunks, jobs, and rows are idempotent success cases. Other failures are thrown so BullMQ can retry; an exhausted cleanup job leaves the soft-deleted row hidden for operational recovery.
6. Processing and embedding transitions require `deletedAt IS NULL`. If deletion races with active work, completion transactions roll back or return a safe deleted outcome without recreating chunks or vectors.

### Question and answer flow

```text
Browser
  -> authenticated POST /api/conversations/:conversationId/messages
  -> validate conversation ownership and question
  -> persist USER message
  -> load up to six prior USER/ASSISTANT messages from that owner-scoped conversation
  -> bound serialized dialogue context to 6,000 characters, newest first
  -> combine dialogue context and the current question into the retrieval query
  -> create query embedding through shared AI provider interface
  -> retrieve up to five owner-scoped READY-document passages with pgvector
  -> assign stable [S1]...[S5] source labels
  -> generate from separated dialogue and retrieved-document contexts
     through the provider-neutral answer interface
  -> atomically persist ASSISTANT message, citation snapshots, source links,
     generation metadata, and conversation activity
  -> after the first successful turn, best-effort generate and persist a short title
  -> return answer and safe source metadata
  -> frontend forces one owner-scoped detail reload for the complete persisted turn
  -> frontend refreshes conversation list page one for canonical title, preview, and ordering
```

The POST response contains only the persisted ASSISTANT message and source DTOs. It does not return
the USER message or updated conversation metadata, so the browser never synthesizes a completed
turn. Message submission is not aborted on navigation and is never retried automatically. An
authoritative detail read after success replaces any older read. After a failure, one controlled
detail read detects the uncommon case where the backend's best-effort USER compensation did not
complete; only a newly persisted matching USER message clears the draft.

The AI provider never determines ownership or authorization. The application filters every retrieval operation before document content is sent to the provider.

## Component responsibilities

### React web application

The implemented frontend foundation includes:

- a React 19, Vite 8, and TypeScript application entry point in `apps/web`;
- Tailwind CSS 4 using its CSS-first configuration and semantic design tokens;
- self-hosted Inter typography and one Lucide icon system;
- reusable typed interface components and composed document, chat, citation, and navigation examples;
- a responsive authenticated `AppShell` with a desktop sidebar and an accessible mobile drawer;
- a centralized Axios API client configured by public `VITE_API_BASE_URL`, with credentials enabled and safe normalized errors;
- runtime-validated authentication contracts and a small service layer under `features/auth`;
- a non-persisted Zustand store with `idle`, `checking`, `authenticated`, `unauthenticated`, and recoverable `unavailable` session states;
- real `/login` and `/register` pages matching the backend email/password contract;
- startup session restoration through `GET /api/auth/me`, protected route guards, intended-destination restoration, centralized `UNAUTHENTICATED` handling, and backend-driven logout;
- real public user data and email/name-derived initials in the authenticated App Shell;
- a real `/dashboard` page that composes owner-scoped document counts, recent documents, recent conversations, and failed-document attention data from existing APIs;
- independent cancellable Dashboard requests with section-scoped loading, error, empty, and retry behavior;
- a real `/documents` page with backend filename search, grouped status filters, pagination, manual refresh, and validated PDF upload;
- a real `/documents/:documentId` page with owner-scoped public metadata, grouped lifecycle presentation, safe failed-processing information, manual refresh, generic not-found handling, confirmed Retry, and confirmed deletion;
- a real `/chat` Conversations Workspace with owner-scoped backend pagination, explicit
  server-confirmed creation, cancellable list reads, and nullable title/preview fallbacks;
- a protected `/chat/:conversationId` route that validates direct selections independently from
  the current list page and uses one generic missing/foreign/deleted presentation;
- an owner-scoped Chat thread that renders persisted USER/ASSISTANT messages as plain text and
  submits one validated 4,000-character question at a time without sending browser history;
- a static `/ui-kit` route that demonstrates component variants, states, loading, empty, feedback, and pagination behavior;
- API client, auth service/store, validation, route, and component interaction tests with Vitest, React Testing Library, and jsdom.

Frontend responsibilities are separated by directory: `components/ui` owns product-neutral
primitives, `components/composed` owns reusable domain-shaped presentations, `components/layout`
owns the responsive shell, `features/auth` owns authentication state and UI,
`features/dashboard` owns Dashboard composition, request lifecycle, section
states, and route composition, `features/documents` owns public document contracts,
list/upload/detail/retry/delete services, debounced query state, cancellation and stale-request
protection, explicit mutation lifecycle states, and responsive document/upload/detail/mutation UI,
`features/conversations` owns shared public conversation/message schemas and DTOs,
list/create/detail/send services, URL-backed pagination, cancellable list/detail lifecycles,
duplicate-safe non-aborted mutations, authoritative turn refresh, failure reconciliation,
direct-route selection, and responsive local-navigation/thread/composer composition,
`pages` owns general route-level composition,
`lib/api-client.ts` owns HTTP configuration and public error normalization, and
`styles/globals.css` owns Tailwind initialization and centralized theme tokens.

The Dashboard deliberately composes `GET /api/documents?page=1&limit=5`,
`GET /api/conversations?page=1&limit=5`, and
`GET /api/documents?status=FAILED&page=1&limit=3`. A dedicated aggregation endpoint is not
justified while these small, independent reads satisfy the product need. The frontend maps all
active internal processing states to one public Processing presentation, starts the reads in
parallel, and retains successfully loaded sections when another read fails. New-user and
no-failure states are explicit, and responsive card/list layouts avoid compressed desktop tables
on small screens. Unsupported concepts such as activity history, worker percentages, charts,
billing, downloads, and direct Dashboard mutations are not rendered.

The Documents feature calls one typed `GET /api/documents` service with Axios query parameters.
Search, public status, page, and limit remain explicit inputs; a 350 ms browser timeout is
sufficient for debounce and avoids another server-state dependency. Query changes cancel the
previous request and old request identifiers cannot overwrite newer data. Upload calls the same
shared client with browser `FormData`, leaving multipart boundary generation to Axios/the browser.
Frontend checks provide fast MIME, size, and empty-file feedback, while backend signature,
ownership, duplicate, and queue validation remain authoritative. Upload success refreshes the
active query without changing page, search, or status, and no polling runs afterward.

The same Documents service validates `GET /api/documents/:documentId` and maps its explicit public
DTO. A route-level hook rejects clearly malformed identifiers before an API request, cancels
replaced reads, prevents duplicate manual refreshes, and ensures an older request cannot replace
newer route data. A failed refresh preserves the last successful DTO with a scoped safe error.
The page maps all active backend lifecycle states to public Processing, renders stored
`processingError` only as escaped plain text for Failed, and preserves the backend's shared
missing/foreign/deleted not-found behavior. Polling is intentionally excluded until the product
requires and designs a real-time update contract.

The Documents service also validates the explicit `202 Accepted` DTO from
`DELETE /api/documents/:documentId`; it sends only the route identifier because the authenticated
cookie defines ownership. A focused delete hook owns `idle`, `confirming`, `deleting`, `success`,
and `error` states, prevents duplicate requests, and deliberately does not abort an accepted
destructive request merely because its component unmounts. The Document Details page exposes the
action only after a successful detail load and reuses the shared destructive Button, Modal, Alert,
Toast, and Card primitives. Delete and manual Refresh are mutually disabled while either request
is active.

No optimistic removal occurs. Only an accepted backend response replaces navigation history with
`/documents`, where normal remounting fetches a list that excludes the soft-deleted record. The
toast distinguishes immediate user-facing removal from asynchronous physical cleanup. A
`DOCUMENT_NOT_FOUND` race uses neutral unavailable feedback, and all other recoverable failures
keep the document and dialog visible for an explicit retry. The shared API client continues to
own `UNAUTHENTICATED` session-expiration behavior. No browser cleanup polling, Undo, Trash, or
Restore state is introduced.

Retry uses a separate focused mutation hook rather than merging recovery and deletion into one
global state machine. Only a public Failed detail renders the recovery action. Confirmation calls
`POST /api/documents/:documentId/retry`; the service runtime-validates the full `202 Accepted`
public Details DTO, maps its internal `PROCESSING` state to the existing public Processing
presentation, and exposes no queue or ownership fields. The response keeps the same document ID,
clears the public processing error and processed timestamp, and becomes the new local Details
resource without route navigation or another read.

The Details hook accepts only a server result matching the active route ID. Applying it aborts and
invalidates any older read request, so a stale Failed Refresh cannot overwrite confirmed
Processing data. Retry, Delete, and Refresh controls disable one another while their corresponding
dialog/request is active. A `404` follows the shared unavailable path; a `409
INVALID_DOCUMENT_STATE` performs one controlled Details refresh with neutral feedback; retryable
queue/server errors preserve the visible Failed DTO for explicit resubmission. No automatic
network retry, status polling, queue progress, or worker-stage UI is introduced.

The visual system is deliberately light-only in this phase. Liquid Glass-inspired gradients and translucency provide atmosphere around readable, mostly solid content surfaces rather than replacing information hierarchy.

The frontend cannot read the opaque session cookie and does not persist a token in Zustand,
localStorage, sessionStorage, URL parameters, or browser-readable cookies. Axios sends the
backend-managed HttpOnly cookie through `withCredentials`. A small auth event utility carries only a confirmed
public `UNAUTHENTICATED` signal from the HTTP layer to the store; the API client therefore does not
depend on Zustand or React Router. Network failure during startup becomes a recoverable
`unavailable` state rather than falsely declaring the credentials invalid.

Unsafe browser requests cross two explicit browser-security boundaries before application logic.
The API first requires the exact configured Origin, then authenticated mutations require an
`X-CSRF-Token` derived with HMAC from the current opaque session credential. The frontend obtains
that token after Login or session restoration, retains it only in module memory, and attaches it
through the centralized Axios client. Origin validation precedes JSON parsing, Redis rate limits,
multipart buffering, and business logic. Private API families set `Cache-Control: private,
no-store`; API responses and production-preview HTML use restrictive CSP, frame denial, MIME,
referrer, and permissions headers. HSTS is limited to validated HTTPS production configuration,
and the production static host must preserve the same frontend headers.

Chat message history and sending, account settings, and other product pages remain future frontend
work. The Conversations Workspace, Dashboard, Documents, and Document Details are API-backed
protected product pages. Document Details owns the only frontend Retry and Delete actions, and the
UI-kit remains a static development showcase.

The frontend consumes API contracts and does not access PostgreSQL, Redis, R2, or OpenAI directly.

### Express API

- authenticate and authorize requests;
- validate every external input;
- coordinate application use cases;
- issue or accept safe uploads through the storage abstraction;
- enqueue long-running work through BullMQ;
- expose owner-scoped semantic search, conversations, and grounded question-answering operations;
- return consistent public errors and observable request identifiers.

HTTP concerns, business logic, persistence, and infrastructure adapters remain separate.
The current API foundation routes requests through controllers, services, and repositories. Prisma Client is initialized once in the API configuration layer; repositories use it for database operations, while the server entry point only invokes lifecycle disconnection during shutdown.
Registration and login validate credentials at the HTTP boundary, apply authentication rules in the service layer, and access users only through repositories. Passwords are hashed with bcrypt before persistence and are excluded from public user responses. Registration always performs password hashing before its unique insert and returns the same `202 VERIFICATION_REQUIRED` response for new and existing normalized emails; an existing account is neither duplicated nor emailed.
After credential verification, the authentication service generates 32 cryptographically random bytes, base64url-encodes them, stores only their SHA-256 hash in `Session`, and places the raw credential in an HttpOnly cookie. Sessions use a fixed seven-day expiry with no sliding renewal. Local HTTP uses a development cookie name; production uses a Secure, host-only `__Host-` cookie. Authentication middleware hashes the cookie and queries PostgreSQL for one non-revoked, unexpired session plus its current user on every protected request. Logout revokes that row before clearing the cookie. Multiple sessions may coexist, and the service layer also exposes an internal revoke-all operation. JWT is no longer a valid runtime authentication path; the historical, unused `RefreshToken` table remains inert for additive migration safety and is not accepted by any code path.
`User.emailVerifiedAt` is nullable. `EmailVerificationToken` stores only a SHA-256 hash of a separate 32-byte random, 60-minute, single-use token. Resend invalidates outstanding unused tokens before creating a new one. Verification URLs use the explicit validated `APP_BASE_URL` and carry the raw token in a frontend URL fragment; the frontend removes it before POSTing to the API. Development may use the guarded console adapter. Railway production selects a Resend HTTPS adapter behind the same email-sender interface; optional SMTP remains available for alternate environments. Email delivery happens outside the database transaction; a failed initial delivery leaves an unverified account recoverable through authenticated resend. Provider failures are classified in secret- and PII-safe structured metadata while browser errors remain generic.
Authentication establishes `req.user` with server-derived `sessionId`, `userId`, `email`, and current `emailVerified`. Authorization remains a separate service-layer decision: repositories return data and ownership fields, while services compare the authenticated `userId` with the resource `userId` or deliberately request an owner-scoped query. Controllers do not decide ownership. A reusable verified-email middleware blocks upload, Retry, semantic search, and AI-backed message creation before expensive storage/provider work; ordinary reads, logout, resend, `/me`, and data deletion remain available. The generic ownership rule returns `403 FORBIDDEN` for a resource known to belong to another user; sensitive ID-based endpoints prefer owner-scoped queries and `404` responses that hide resource existence.
Document list reads validate and normalize pagination, filename search, and public status filters before reaching the service. The repository applies owner and search conditions consistently to the paginated query, filtered total, and grouped status counts. The selected status applies to the page and total but not to status counts, allowing the UI to switch filters without another unfiltered request. Public `PROCESSING` aggregates `PENDING`, `PROCESSING`, `CHUNKS_READY`, and `EMBEDDING`; list ordering is `createdAt DESC`, then `id DESC`.
Document detail reads implement that hidden-existence policy: `GET /api/documents/:documentId` selects by both document ID and authenticated user ID, and missing or foreign-owned records return the same `DOCUMENT_NOT_FOUND` response. The service constructs an explicit public DTO and exposes the stored safe `processingError` only while the document is `FAILED`; storage keys, hashes, metadata, chunks, embeddings, and Prisma relations remain private.
Manual retry uses the same owner-hidden policy. Its repository transaction owns the `FAILED` to `PROCESSING` business-state guard and artifact cleanup, while the service coordinates queue submission and compensation. The controller only reads the authenticated user and validated route parameter before returning the safe detail DTO.
The search controller validates the HTTP body and reads `req.user`; the retrieval service creates the question embedding and coordinates the use case; the vector repository applies the owner filter and cosine ranking in the same parameterized SQL statement. Provider failures become a safe `503` response, while raw provider details stay internal.
Conversation controllers handle only authenticated HTTP contracts and validated pagination. The conversation service enforces owner-scoped `404` behavior, coordinates persistence, bounded context construction, retrieval, prompt construction, generation, title generation, list DTOs, and failure compensation. The conversation repository excludes `deletedAt` records from ordinary reads, applies owner scoping to pages, totals, details, and context history, selects only the latest USER message for previews, and atomically persists assistant content, citation JSON, AI metadata, source-chunk relations, and the activity timestamp. Recent context queries exclude the current message and return at most six previous USER/ASSISTANT messages from only the active owner-scoped conversation. Title generation reuses the existing provider abstraction only after the first successful turn; its errors are logged safely and never change the main message response.

The grounded-answer prompt requires plain-text output and forbids Markdown or HTML presentation
syntax because the frontend deliberately renders AI content as untrusted text. Source labels such
as `[S1]` remain part of the grounding contract and are also persisted as structured citation
snapshots; conversation history may clarify dialogue but retrieved authorized chunks remain the
only factual evidence.

The web Conversations feature consumes those existing contracts through the shared credentialed
Axios client. `/chat?page=N` owns the backend list page and `/chat/:conversationId?page=N` keeps
selection separate from pagination. List and detail reads use AbortSignal plus request identities;
a newer page or route cannot be overwritten by an older response. Creating a conversation is an
explicit non-aborted mutation with one in-flight promise: after `201 Created`, the frontend keeps
the server ID, navigates to page one, and invalidates any pre-create list read before one
authoritative refresh. No conversation is inserted optimistically.

At desktop widths the Chat feature uses a bounded glass local-navigation panel beside a more
opaque selected workspace whose thread scrolls independently above a visible composer. Tablet and
mobile use route-based single-panel navigation and retain the list page in the URL. Direct
selections are validated by the detail endpoint rather than by scanning list pages. Nullable
titles and latest-USER previews use display-only fallbacks.

The selected route renders backend-ordered USER and ASSISTANT messages with semantic role labels,
plain-text line preservation, long-word wrapping, and no HTML or Markdown interpretation. The
controlled native textarea supports Enter submit, Shift+Enter newline, IME composition, visible
validation, focus restoration, and a 4,000-character ceiling matching the API. One POST can be in
flight; repeated clicks or Enter presses reuse it. The browser sends only `{ content }` because
bounded conversation memory, retrieval, grounding, insufficient-context behavior, and AI
orchestration belong to the backend.

POST success triggers one forced detail reload and one page-one list refresh. Request identities
prevent older detail/list reads or conversation A mutations from overwriting conversation B.
Failure reconciliation preserves a retryable draft when compensation removed the USER message and
clears it only when authoritative history proves that the matching USER message persisted.
Persisted ASSISTANT source DTOs are runtime validated and mapped in backend order to accessible
cards showing `[S#]`, the server document name, and an optional positive page. React Router links
encode the backend document ID and open the existing owner-scoped Document Details route. USER
messages and empty-source ASSISTANT messages render no source section; repeated sources remain
repeated, while chunk IDs and positions are never displayed. The frontend does not infer citations
from answer text or treat a source card as PDF viewing or page navigation. Streaming, polling,
WebSockets, Markdown, regeneration, editing, attachments, rename, and sharing remain outside this
phase.

### Node.js background worker

- consume `document.process` BullMQ jobs outside the HTTP request lifecycle;
- reload the referenced document from PostgreSQL and verify the job's ownership context;
- apply safe and idempotent document lifecycle transitions;
- log completed and failed jobs without terminating the worker process;
- read PDFs through the object storage interface;
- extract page text behind a replaceable parser service;
- deterministically split text into ordered page-aware chunks;
- atomically replace chunks and transition successful extraction to `CHUNKS_READY`;
- submit and consume separate identifier-only embedding jobs;
- request embeddings through the AI provider interface;
- atomically persist embeddings and their model metadata before transitioning to `READY`;
- consume identifier-only cleanup jobs and delete storage before database data;
- keep retryable failures in active lifecycle states and persist `FAILED` only on the final attempt;
- implement safe retries and idempotent processing.

File reading, text extraction, chunking, embedding generation, lifecycle transitions, retry compatibility, and idempotent chunk/vector persistence are implemented. The worker shares stable queue contracts with the API but is an independently runnable process with its own storage, Prisma, BullMQ, and provider connections.

### PostgreSQL and Prisma

- PostgreSQL is the source of truth for users, ownership, metadata, soft deletion, processing status, conversations, chunks, references, and embeddings;
- relational constraints enforce valid relationships and support ownership boundaries;
- Prisma is the primary ORM and migration tool;
- the initial schema defines users, directly user-owned documents, document chunks, conversations, messages, and refresh tokens;
- projects, collections, and folders are not represented in the current schema and require a later product and data-model decision;
- persistence modules prevent database details from leaking into HTTP and business logic;
- parameterized raw SQL may be used inside the persistence layer when an essential PostgreSQL or pgvector operation cannot be expressed safely through Prisma.
- `Message.citations` stores a durable source snapshot, while `Message.aiMetadata` separately stores provider, model, token usage, and duration;
- the live `Message.sourceChunks` relation supports navigation while citation JSON remains understandable if a source is later hard-deleted;
- conversation listing and detail queries exclude soft-deleted rows; lists use owner-scoped totals, deterministic newest-activity pagination, and a bounded latest-USER-message preview;
- generated conversation titles use the existing nullable `Conversation.title`, so this UX alignment requires no schema migration.

### Object storage and Cloudflare R2

- original file bytes are stored outside PostgreSQL;
- PostgreSQL stores file metadata and opaque object keys;
- original files are private by default;
- reads and deletions happen through an application-owned storage interface;
- Cloudflare R2 is the production adapter and uses its S3-compatible endpoint with the AWS SDK;
- a filesystem adapter stores objects under an ignored local directory for development and verification only;
- stable application-owned keys use `users/<owner>/documents/<uuid>.pdf`, so another object storage provider can be introduced without changing document business rules.
- the API writes files and performs upload compensation, while the worker uses read/delete interfaces for processing and asynchronous cleanup; file bytes never pass through Redis.

### Redis and BullMQ

- BullMQ provides asynchronous coordination of document-processing, embedding, and permanent-cleanup jobs;
- Redis holds queue state used by BullMQ;
- separate lazy API Redis clients hold fixed-window authentication and expensive-route limiter counters;
- authentication limiter keys hash IP/email/user subjects and never store a raw email identity;
- limiter failure returns a safe `503` rather than silently disabling protection;
- the API is the queue producer and uses a connection configured to fail promptly when Redis is unavailable;
- the worker consumes all three queues using independent long-lived blocking connections;
- jobs use three attempts with exponential backoff, while invalid contracts and invalid business states are non-retryable;
- processors read the job's configured attempt count; intermediate failures remain active with no persisted error, and final or explicitly unrecoverable failures store one safe error;
- `failed` event listeners are synchronous logging only because BullMQ emits that event for retryable failures as well as terminal failures;
- document-processing and embedding concurrency are independently configurable and each defaults to one;
- cleanup concurrency is one;
- job payloads contain only `documentId` and `userId`, never raw document contents;
- Redis is not automatically a general application cache. Cache use requires a separate measured need and invalidation design.

### ResourceGuard and cost controls

- PostgreSQL is durable quota truth. Owner-scoped document rows and short-lived
  `DocumentQuotaReservation` leases enforce count, original-byte, and active-processing limits
  under a stable `User` row lock; Redis is never used for durable quota accounting.
- Upload reserves one document, its server-observed buffer length, and one processing slot before
  object-storage I/O. Durable document creation consumes that lease atomically. Retry locks the same
  owner row and reserves only by transitioning the existing `FAILED` row into an active state.
- Soft deletion removes a document from effective usage immediately. A short rollback-capacity hold
  exists only until cleanup queue acceptance so explicit enqueue compensation cannot overrun quota.
- `AiTurnReservation` rows enforce 30 successfully persisted answer turns in a rolling 24-hour
  window. The assistant write and turn commit share one transaction; deterministic no-context and
  failed turns release their reservation.
- `AiBudgetPeriod`, `AiBudgetReservation`, and `AiUsageRecord` serialize a $20 UTC monthly OpenAI
  budget using integer micro-USD. Every question embedding, answer, title, and document embedding is
  reserved before its provider path and reconciled from provider usage or a conservative estimate.
- Provider-side retries are disabled so hidden SDK attempts cannot bypass accounting. The API and
  worker remain responsible for explicit, observable retry behavior.

### AI provider and OpenAI

- `packages/ai` owns provider-neutral embedding and answer-generation interfaces plus their initial OpenAI adapters;
- the implemented embedding interface accepts application text and returns validated vectors without exposing OpenAI SDK types;
- the implemented answer interface accepts separated system instructions, optional conversation context, retrieved context, and the current user question, then returns content, provider/model, token usage, and duration;
- OpenAI is the initial embedding provider implementation, using `text-embedding-3-small` with an explicit 1,536 dimensions;
- OpenAI Responses API is the initial answer provider implementation, with a configurable `gpt-5.6-sol` default, bounded output, and provider-side response storage disabled;
- provider credentials, model identifiers, request formats, and response formats remain inside infrastructure adapters;
- the application owns retrieval, authorization, source references, and insufficient-evidence behavior.

### Grounded prompt and conversation behavior

- retrieved chunks receive stable labels in ranked order and carry document name, chunk position, and page metadata;
- model instructions require evidence-only answers, label citations, and an explicit insufficient-context response;
- post-generation validation rejects missing or unknown labels and persists only sources cited by the answer;
- source text and document names are treated as untrusted data rather than model instructions;
- empty retrieval returns a deterministic response without calling the answer provider;
- up to six prior USER/ASSISTANT messages (three exchanges) from the active owner-scoped conversation are serialized under a strict 6,000-character limit; newest messages are retained when the limit is exceeded;
- bounded dialogue context is used for reference resolution in retrieval and generation, but it is separated from retrieved chunks, cannot be cited, and is explicitly not a factual source;
- no other conversation, user, long-term memory, summary, or message embedding participates in the turn;
- a failed turn triggers best-effort removal of its new USER message; a process crash can still leave a partial turn until explicit turn-state recovery is designed.

### pgvector

- embeddings are stored alongside relational document-chunk data in PostgreSQL;
- similarity queries use cosine distance and convert it to similarity with `1 - distance`;
- the repository filters by the authenticated `userId`, `deletedAt IS NULL`, `READY` document state, embedding model, and dimensions before returning at most five chunks;
- semantic retrieval complements metadata and keyword search;
- the first migration enables pgvector, and the embedding-pipeline migration constrains the chunk column to `vector(1536)` without a similarity index;
- exact search is used initially; retrieval quality and query performance must be measured before adding an HNSW or IVFFlat index or specialized vector infrastructure.

## Initial security boundaries

- Every document operation is scoped to the authenticated owner.
- File type, size, name, and metadata are validated.
- PDF parsing is isolated in a termination-capable Worker Thread and bounded by page, extracted-text,
  chunk, time, heap, and stack limits before embedding work can begin.
- Original files are not publicly addressable by default.
- Retrieved passages are authorization-filtered before reaching an AI provider.
- Missing, soft-deleted, and foreign-owned conversations use the same `404` response.
- Public conversation history contains only `USER` and `ASSISTANT` messages; internal `SYSTEM`
  records are never serialized to the browser.
- Model-facing prompts never include storage keys, file hashes, embeddings, or another user's chunks.
- Assistant persistence revalidates every cited chunk against the authenticated owner and a
  non-deleted `READY` document before creating source relations.
- Database, storage, Redis, and provider credentials stay on the server.
- Logs do not contain raw document contents, passwords, tokens, or sensitive AI prompts by default.
- Job payloads do not grant authority; the worker re-establishes the required ownership context from trusted records.
- Deletion covers metadata, stored files, chunks, embeddings, and other derived search data.

The verified owner-isolation model, adversarial evidence, and remaining trusted boundaries are
documented in [`docs/security.md`](security.md).

## Repository direction

The approved repository structure is a monorepo managed with npm workspaces:

```text
apps/
  web/
  api/
  worker/
packages/
  ai/
  shared/
docs/
```

The directories and package manifests now exist. `packages/shared` contains the stable document-processing, embedding, and deletion queue names, identifier-only job contracts, payload validation, Redis URL parsing, and the narrow PostgreSQL AI-budget repository shared by the API and worker. It must not become a collection of unrelated business logic. `packages/ai` contains provider-neutral embedding and answer services, centralized OpenAI pricing estimates, and the OpenAI adapters shared by the API query path and worker document path; provider credentials remain application environment concerns.

## Recorded decisions

- [ADR-0001: Use a monorepo with npm workspaces](decisions/0001-monorepo-architecture.md)
- [ADR-0002: Use an object storage abstraction with Cloudflare R2](decisions/0002-object-storage.md)
- [ADR-0003: Use PostgreSQL with Prisma ORM](decisions/0003-database-layer.md)
- [ADR-0004: Use PostgreSQL with pgvector for vector search](decisions/0004-vector-search.md)
- [ADR-0005: Use an AI provider abstraction with OpenAI](decisions/0005-ai-provider.md)
- [ADR-0006: Target individual developers first](decisions/0006-target-individual-developers-first.md)
- [ADR-0007: Use pdf-parse behind a worker parser abstraction](decisions/0007-pdf-text-extraction.md)
- [ADR-0008: Generate embeddings in a separate queue](decisions/0008-embedding-pipeline.md)
- [ADR-0009: Use owner-scoped cosine retrieval](decisions/0009-semantic-retrieval.md)
- [ADR-0010: Generate grounded answers with application-owned conversations](decisions/0010-rag-answer-generation.md)
- [ADR-0011: Use revocable server-side sessions and verified email capability](decisions/0011-server-sessions-email-verification.md)

## Decisions still required before their implementation phases

- Package-boundary conventions beyond the shared TypeScript and lint configuration.
- REST endpoint conventions and versioning strategy.
- User-facing session inventory, security-event handling, and removal of the inert historical `RefreshToken` table.
- Whether larger future uploads should move from the current bounded API-proxied flow to presigned direct-to-storage uploads.
- Test infrastructure strategy beyond the existing local PostgreSQL and Redis services.
- Whether best-effort queue compensation is sufficient or a transactional outbox is justified by delivery requirements.
- The relevance threshold and pgvector index strategy after retrieval evaluation and query-plan measurement.
- Whether a stronger operating-system parser sandbox, malware scanning, or content-disarm layer is
  justified beyond the current bounded Worker Thread containment, and any later supported formats.
- Answer-model quality/cost evaluation, more capable retrieval-query rewriting, and stronger partial-turn recovery.

These questions should be resolved in the phase where they become necessary rather than by speculative implementation.
