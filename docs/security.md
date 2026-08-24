# Security model

This document records the implemented security boundaries that were verified through Phase 13B.5.2.
It describes current guarantees, not controls planned for later Phase 13 work.

## Identity and authorization boundary

The backend-managed opaque session cookie is the only browser authentication credential. The API
resolves it to the current PostgreSQL session and places a server-derived `sessionId`, `userId`,
email, and verification state on `req.user`. Request bodies, route parameters, queue payloads, and
AI output never establish ownership.

Sensitive identifier-based endpoints deliberately use owner-scoped queries. A missing,
foreign-owned, or soft-deleted resource returns the same generic not-found response so its
existence and metadata cannot be inferred.

## Owner-isolation invariants

- Document listing, details, Retry, and deletion bind the authenticated `userId` in the database
  query. Public DTOs omit owner IDs, storage keys, hashes, chunks, embeddings, and infrastructure
  metadata. Upload assigns the authenticated owner on the server.
- Conversations are listed and loaded only through their authenticated owner and `deletedAt IS
NULL`. Message history and bounded context are reached only through that owner-scoped parent.
  Public history contains only `USER` and `ASSISTANT` messages; internal `SYSTEM` rows are not
  serialized.
- The browser can submit only message content. Citations are built from newly retrieved chunks on
  the server. Assistant persistence revalidates every cited chunk against the same authenticated
  owner, a non-deleted document, and `READY` state before storing source relations.
- pgvector search joins chunks to documents and applies owner, non-deleted, `READY`, model, and
  dimension filters before cosine ranking and limiting. Another user's vector cannot enter the
  model context even when it is semantically closer.
- Soft-deleted documents are excluded from list, detail, citation persistence, and new semantic
  retrieval. Soft-deleted conversations provide neither public history nor bounded context.
- BullMQ payloads contain identifiers only and do not grant authority. Processing, embedding, and
  cleanup workers reload authoritative database state, compare the queued owner with the stored
  owner, reject invalid lifecycle states, and stop safely for deleted or missing records. Their
  mutations repeat owner and deletion predicates, with chunk/vector writes protected by database
  transactions.

## Phase 13B.2 adversarial evidence

Automated tests cover the following attacks and positive controls:

- User A cannot list, read, delete, Retry, or discover metadata for User B's document; the owner can
  perform the corresponding supported operations.
- User A cannot load User B's conversation, message history, citations, or context, and cannot post
  a message into it by changing a route ID or adding client-controlled `userId`, `ownerId`, or
  citation fields.
- Missing, foreign-owned, deleted, and malformed resource identifiers preserve their documented
  response contracts.
- A real PostgreSQL/pgvector query excludes a closer User B vector, a soft-deleted User A vector,
  and a non-`READY` User A vector before returning User A's permitted result.
- Citation persistence rejects foreign-owned, soft-deleted, and non-`READY` chunks without creating
  an assistant message or source relation.
- Processing and embedding jobs reject mismatched owner payloads before file, chunk, or provider
  work. Deleted-document jobs stop safely.
- Cleanup cannot discover or delete another user's soft-deleted document, chunk, or embedding;
  valid owner cleanup remains idempotent.

## Phase 13B.3 resource and cost controls

Resource admission is split by trust boundary:

- Redis applies fixed-window burst controls of 20 upload attempts/IP/hour and 60 AI attempts/IP/hour
  using the same trusted Express `req.ip` model as authentication limits. These expensive routes
  fail closed with a safe `503` when the limiter is unavailable.
- PostgreSQL is durable truth for owner quotas. A stable `User` row lock serializes admissions.
  Non-deleted `Document` rows plus active, expiring reservations enforce 25 documents, 150 MiB of
  original `sizeBytes`, and two active pipelines in `PENDING`, `PROCESSING`, `CHUNKS_READY`, or
  `EMBEDDING`. `READY`, `FAILED`, foreign, and soft-deleted documents do not consume a processing
  slot. Retry consumes only a processing slot, not another document or storage allowance.
- A successful AI turn means one grounded assistant answer durably persisted for the authenticated
  user's active conversation. Question embedding, answer generation, and best-effort title creation
  are still one turn. Up to 30 committed or actively reserved turns are allowed per rolling 24
  hours. Invalid, foreign, deterministic no-context, provider-failed, and persistence-failed turns
  do not commit the user allowance.
- A single UTC-month `AiBudgetPeriod` row serializes the global OpenAI budget. Active reservations
  and committed integer micro-USD estimates are checked atomically against the configured $20
  limit. `AiUsageRecord` covers question embeddings, grounded answers, titles, and document
  embeddings. Unknown priced models fail closed; provider failures without reported usage are
  conservatively charged at the reserved estimate.
- Fifty- and eighty-percent warnings are recorded once per month and emitted as bounded structured
  operational logs. The one-hundred-percent boundary rejects new provider work without exposing
  spend or pricing details. Reads, authentication, logout, document deletion, and cleanup never
  depend on AI budget availability.
- Embedding budget denial happens before `CHUNKS_READY` moves to `EMBEDDING`. BullMQ delays the same
  job until a relevant reservation expiry or the next UTC month, with a minimum delay, so a healthy
  document is not marked `FAILED` solely because the budget is exhausted.

Reservations expire and are reconciled lazily under the same database locks. This prevents crashed
requests from permanently consuming capacity. A short deletion rollback hold prevents a cleanup
enqueue failure from restoring a document after another upload has consumed its just-released
capacity.

## Phase 13B.4 browser security boundary

Every unsafe browser request is checked against the single explicit `CORS_ORIGIN` before JSON
parsing, rate limiting, multipart buffering, or application logic. Missing, `null`, wildcard, and
unknown origins are rejected; production startup additionally requires an HTTPS origin and a valid
`NODE_ENV`. CORS remains a browser response-sharing policy rather than an authorization control.

Authenticated unsafe requests also require `X-CSRF-Token`. The API derives this token with HMAC
from the opaque session credential and a server-only `CSRF_SECRET`, so it is bound to one current
session without another database field. The web client fetches it from `GET /api/auth/csrf-token`
after Login or `/me`, keeps it only in module memory, and automatically adds it to authenticated
`POST`, `PUT`, `PATCH`, and `DELETE` requests. Public registration, Login, and email-verification
submission have no session yet and rely on the same mandatory Origin boundary.

Auth, document, conversation, and search responses use `Cache-Control: private, no-store`.
Application responses set a restrictive self-only CSP, deny framing, objects, and base-URL changes,
disable MIME sniffing, minimize referrer disclosure, and deny unused camera, microphone, and
geolocation capabilities. HSTS is emitted only for a validated HTTPS production environment. The
Vite production-preview configuration applies the matching document policy; the eventual static
host or edge must preserve those headers in the real deployment.

The Phase 14.2 production boundary uses one public Caddy Web origin. Caddy serves static assets and
proxies `/api/*` to the private API while preserving the route, cookies, `Origin`, CSRF headers, and
API response headers. Express trusts only an explicit bounded number of proxy hops. The exact
Railway chain must be verified before launch so a client-controlled forwarding header cannot spoof
the IP identity used by rate limits. Production configuration fails closed on missing or insecure
public origins, local storage, missing private Redis, missing R2 credentials, or missing OpenAI
credentials. See [`deployment.md`](deployment.md).

## Phase 13B.5.2 PDF containment boundary

PDF processing is bounded independently of the upload-size and owner-quota controls. One
central configuration limits a PDF to 150 pages, 1,000,000 extracted characters, 1,000 chunks, and
30 seconds of parser execution. The parser runs in a dedicated Node Worker Thread with explicit
heap and stack resource limits. A timeout terminates that thread; a parser exception or thread
failure is contained without terminating or blocking the BullMQ process, embedding consumer, or
cleanup consumer.

Before buffering object content, the storage adapter compares local file metadata or R2
`ContentLength` with the authoritative `Document.sizeBytes` value, then verifies the final byte
count. The processing worker checks the `%PDF-` signature again before parsing. Text is extracted
one page at a time: the declared page count is rejected before full extraction, and cumulative
characters are checked after every page. The chunker enforces its total limit before appending a
chunk. No chunks are persisted until all parser and chunk checks pass.

`PDF_PAGE_LIMIT_EXCEEDED`, `PDF_TEXT_LIMIT_EXCEEDED`, `PDF_CHUNK_LIMIT_EXCEEDED`, and
`PDF_PROCESSING_TIMEOUT` are typed non-retryable failures. Safe parser-crash and stored-file
validation failures use the same non-retryable boundary. The processing worker records `FAILED`
once and throws BullMQ's unrecoverable error, so deterministic hostile-file failures do not consume
automatic retries. Because `document.embed` is enqueued only after successful transactional chunk
persistence, every rejected PDF creates zero embedding jobs, provider calls, or AI-budget
reservations. The upload parser separately accepts one file, no text fields, and a bounded number
of multipart parts before storage, database, or queue work.

## Remaining limitations and trusted boundaries

- PostgreSQL row-level security is not enabled. Isolation is enforced by application-owned queries,
  service rules, DTOs, and regression tests, so every future private resource path must preserve the
  same pattern.
- Redis is trusted infrastructure. Production Redis must be private, authenticated, and use TLS
  where supported. Local Docker exposes an unauthenticated development instance on localhost only.
- Citation JSON is a durable, server-generated snapshot. An owner may still read a citation in their
  own historical conversation after the source document is deleted; the live chunk relation and all
  new retrieval access are removed. This is intentional and does not grant source-file access.
- A Worker Thread is a termination and resource-containment boundary, not an operating-system
  malware sandbox. Stronger process/container isolation, antivirus or content-disarm scanning, and
  parser sandboxing remain potential deployment controls if the threat model expands beyond the
  public-demo profile.
- The worker still downloads the complete original into memory before parsing, but the existing
  10 MiB upload limit bounds that allocation. Streaming object retrieval and streaming parser
  support remain future scalability work rather than a current containment requirement.
- Phase 13B.5.2 does not complete later Phase 13 work for operational monitoring or production
  security verification.
- PostgreSQL-to-BullMQ delivery is still best-effort with compensation rather than a transactional
  outbox. A process crash can strand an active document or hidden deletion until Phase 13B.6
  reconciliation. Orphaned storage-object repair is also deferred.
- Worker concurrency is bounded per process (one parser, one embedding consumer, one cleanup
  consumer). Multiple worker replicas require a later deployment-level global concurrency policy.
- The message POST contract has no client idempotency key. The frontend prevents duplicate submits
  and quota reservations cap concurrency, but transport-level replay protection remains deferred.
