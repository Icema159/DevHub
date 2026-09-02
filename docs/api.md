# API contracts

## Shared behavior

Document endpoints require the opaque HttpOnly session cookie. Missing, expired, revoked, or random credentials use the standard `401 UNAUTHENTICATED` error. Validation failures use `400 INVALID_INPUT`.

All document operations are scoped to the authenticated owner in their database queries. Public DTOs are explicitly constructed and do not expose owner identifiers, storage keys, hashes, metadata, chunks, embeddings, queue identifiers, or Prisma relations. A document with `deletedAt != null` is treated as missing and uses the same `404 DOCUMENT_NOT_FOUND` contract.

## Authentication

Authentication uses a backend-managed opaque session credential. Local development uses the
`developer_knowledge_hub_session` HttpOnly cookie; production uses
`__Host-developer-knowledge-hub-session`. Browser clients include credentials, but JavaScript must
not attempt to read or store them. PostgreSQL stores only a SHA-256 hash and validates the current
session and user on every authenticated request. The fixed lifetime is seven days with no sliding
renewal.

All successful user responses expose only:

```json
{
  "user": {
    "id": "user-id",
    "email": "developer@example.com",
    "emailVerified": false,
    "name": null,
    "createdAt": "2026-07-29T08:30:00.000Z"
  }
}
```

### Register

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "developer@example.com",
  "password": "password123"
}
```

Returns the same generic response for a new or existing address and does not issue a session:

```json
{
  "data": {
    "status": "VERIFICATION_REQUIRED"
  }
}
```

The status is `202 Accepted`. A new account is created with `emailVerifiedAt = null`, receives a
hashed, single-use verification token that expires after 60 minutes, and is sent the raw token only
through the configured mail adapter. Existing registrations do not create a duplicate user or
trigger another message. Invalid credentials input uses `400 INVALID_INPUT`.

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "developer@example.com",
  "password": "password123"
}
```

Returns `200 { user }`, creates an independent PostgreSQL `Session`, and sets its raw opaque token
in the HttpOnly cookie. Invalid email/password combinations use the same
`401 INVALID_CREDENTIALS` response whether or not the account exists. Unverified accounts may
login and receive `emailVerified: false`.

### Current user

```http
GET /api/auth/me
```

Returns `200 { user }` for a current database session. A missing, random, expired, or revoked
session uses `401 UNAUTHENTICATED`.

### Verify email

```http
POST /api/auth/verify-email
Content-Type: application/json

{
  "token": "opaque-token-from-email"
}
```

Returns `200 { "data": { "status": "VERIFIED" } }`. The token is hashed before lookup, must be
unused and unexpired, and is consumed once. Invalid, expired, reused, and superseded tokens all use
`400 INVALID_OR_EXPIRED_VERIFICATION`.

### Resend verification

```http
POST /api/auth/resend-verification
```

Requires an authenticated session. For an unverified account, invalidates every outstanding token,
creates a new 60-minute token, and returns `200` with `VERIFICATION_SENT`. A verified account
returns the safe `ALREADY_VERIFIED` state without sending another message.

### Logout

```http
POST /api/auth/logout
```

Requires a current session. Revokes that session in PostgreSQL, then returns `204 No Content` and
clears the matching cookie. A copied pre-logout credential cannot authenticate afterward. Other
active sessions for the same user remain valid.

### Browser mutation protection

All browser `POST`, `PUT`, `PATCH`, and `DELETE` requests must carry the exact configured `Origin`.
Authenticated mutations must additionally carry the session-bound token returned by:

```http
GET /api/auth/csrf-token
```

The response is:

```json
{
  "data": {
    "csrfToken": "session-bound-token"
  }
}
```

The browser keeps this value only in memory and sends it as `X-CSRF-Token`. Missing or invalid
origins use `403 INVALID_ORIGIN`; missing, invalid, or cross-session CSRF tokens use `403
CSRF_VALIDATION_FAILED`. Origin validation runs before request parsing, rate limiting, multipart
buffering, and business logic. Registration, Login, and email-verification submission occur before
an authenticated session exists and therefore require the Origin check but not a CSRF token.

Authentication, document, conversation, and search responses use `Cache-Control: private,
no-store`, including private mutation responses.

### Verification authorization and abuse controls

Unverified sessions may use Login, Logout, Current user, Resend, ordinary owner-scoped reads, and
data removal. They receive `403 EMAIL_VERIFICATION_REQUIRED` before document upload, document
Retry, semantic search, or AI-backed conversation-message generation.

Authentication limits are Redis-backed and fail closed with `503 AUTH_PROTECTION_UNAVAILABLE` if
limiter state cannot be reached. Exceeded limits return `429 RATE_LIMITED` and `Retry-After`:

- registration: 5 attempts per IP per 60 minutes;
- login: 30 attempts per IP and 10 attempts per normalized email identity per 15 minutes;
- verification resend: 3 per authenticated user and 5 per IP per 60 minutes;
- verification submission: 20 per IP per 60 minutes.

Identity values are SHA-256 hashed in Redis keys. Client IP uses Express `req.ip`. Development
defaults to disabled proxy trust; production requires explicit `TRUSTED_PROXY_HOPS` from 0 to 2.
The chosen value must be verified against the actual Caddy/Railway chain and forwarding-header
spoof tests; configuration validation alone cannot establish trustworthy client IPs.

### Resource quotas and AI cost controls

Verified upload and AI routes also use Redis fixed windows: 20 upload attempts per trusted IP per
hour and 60 AI/search attempts per trusted IP per hour. Exceeded limits return `429
RESOURCE_RATE_LIMITED` with `Retry-After`; limiter failure returns `503
RESOURCE_PROTECTION_UNAVAILABLE`. These counters are abuse controls, not durable usage truth.

PostgreSQL atomically enforces per authenticated owner: 25 non-deleted documents, 157,286,400
original PDF bytes, two active processing pipelines, and 30 successfully persisted AI answer turns
per rolling 24 hours. Stable errors are `DOCUMENT_LIMIT_REACHED`, `STORAGE_LIMIT_REACHED`,
`PROCESSING_LIMIT_REACHED`, and `AI_DAILY_LIMIT_REACHED`. The global OpenAI hard stop returns `503
AI_TEMPORARILY_UNAVAILABLE`; it never exposes spend, reservations, or pricing metadata and does not
affect ordinary reads, authentication, logout, deletion, or cleanup.

The deterministic empty-retrieval answer releases its AI-turn reservation. If retrieval found
chunks but the invoked model returns the fixed insufficient-context answer, the normal response
persistence path currently commits that turn. Either path may already incur query-embedding cost;
user-turn accounting and provider-cost accounting are separate.

## Upload document

```http
POST /api/documents
Content-Type: multipart/form-data
```

Requires an authenticated user with a verified email address. The verification gate runs before
multipart buffering.

The request contains exactly one file in the multipart field named `file`. The configured local
maximum is 10 MiB. Multer first requires MIME type `application/pdf`; the document service then
validates the filename and `%PDF-` signature. Browser validation is only an early usability check
and does not replace these backend rules.

A successful upload returns `201 Created`:

```json
{
  "document": {
    "id": "document-id",
    "name": "Authentication Guide.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 1887436,
    "status": "PENDING",
    "processedAt": null,
    "createdAt": "2026-07-29T09:00:00.000Z",
    "updatedAt": "2026-07-29T09:00:00.000Z"
  }
}
```

Relevant public failures include `FILE_REQUIRED`, `UNSUPPORTED_FILE_TYPE`, `FILE_TOO_LARGE`,
`INVALID_PDF`, `INVALID_FILE_NAME`, `DUPLICATE_DOCUMENT`, and
`PROCESSING_QUEUE_UNAVAILABLE`. The frontend maps these codes to safe messages and never exposes
hashes, storage keys, database constraints, or raw queue/storage errors.

## List documents

```http
GET /api/documents
```

### Query parameters

| Parameter | Default | Rules                                                                       |
| --------- | ------- | --------------------------------------------------------------------------- |
| `page`    | `1`     | Positive integer                                                            |
| `limit`   | `10`    | Positive integer, maximum `100`                                             |
| `search`  | none    | Trimmed, case-insensitive filename substring; empty input applies no search |
| `status`  | `ALL`   | One of `ALL`, `READY`, `PROCESSING`, or `FAILED`                            |

Search never inspects extracted content, chunks, embeddings, metadata, storage keys, or hashes.

Public statuses map to database states as follows:

| Public filter | Database states                                      |
| ------------- | ---------------------------------------------------- |
| `ALL`         | No state filter                                      |
| `READY`       | `READY`                                              |
| `PROCESSING`  | `PENDING`, `PROCESSING`, `CHUNKS_READY`, `EMBEDDING` |
| `FAILED`      | `FAILED`                                             |

Documents are ordered by `createdAt DESC`, then `id DESC` for deterministic pagination.

### Successful response

```json
{
  "data": {
    "documents": [
      {
        "id": "document-id",
        "filename": "Authentication Guide.pdf",
        "mimeType": "application/pdf",
        "size": 1887436,
        "processingState": "READY",
        "createdAt": "2026-07-20T11:15:00.000Z",
        "updatedAt": "2026-07-20T11:17:00.000Z",
        "processedAt": "2026-07-20T11:17:00.000Z"
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 9,
    "totalPages": 1,
    "statusCounts": {
      "all": 12,
      "ready": 9,
      "processing": 2,
      "failed": 1
    }
  }
}
```

`meta.total` counts non-deleted documents matching the owner, current filename search, and current status filter. `totalPages` is `ceil(total / limit)` and is `0` when total is zero.

`statusCounts` is always owner-scoped and applies the current filename search, but deliberately ignores the current status filter. Consequently, the counts remain useful when switching between status tabs. With the current status enum, `all` always equals `ready + processing + failed`.

List DTOs do not include `processingError`; that field belongs to document details.

## Get document details

```http
GET /api/documents/:documentId
```

A successful response returns `id`, `filename`, `mimeType`, `size`, `processingState`, `processingError`, `createdAt`, `updatedAt`, and `processedAt` under `data.document`. `processingError` contains the stored safe error only when `processingState` is `FAILED`; otherwise it is `null`.

A missing, foreign-owned, or soft-deleted document returns the same `404 DOCUMENT_NOT_FOUND` error so existence and ownership cannot be inferred.

The web client consumes this endpoint on the protected `/documents/:documentId` route. It displays
only the explicit public fields, maps all active lifecycle values to one Processing presentation,
and renders `processingError` as escaped plain text only when supplied for a Failed document.
Missing, foreign-owned, and soft-deleted responses intentionally share one generic not-found UI.
The page supports explicit manual refresh; it does not poll or expose storage, chunk, embedding, or
ownership internals.

## Retry document processing

```http
POST /api/documents/:documentId/retry
```

Only an active, owner-scoped document in terminal `FAILED` state is eligible. A successful request atomically changes it to `PROCESSING`, clears `processingError` and `processedAt`, removes previous chunk/vector artifacts, submits a fresh identifier-only `document.process` job, and returns `202 Accepted` with the updated public detail DTO:

```json
{
  "data": {
    "document": {
      "id": "document-id",
      "filename": "Authentication Guide.pdf",
      "mimeType": "application/pdf",
      "size": 1887436,
      "processingState": "PROCESSING",
      "processingError": null,
      "createdAt": "2026-07-20T11:15:00.000Z",
      "updatedAt": "2026-07-23T10:00:00.000Z",
      "processedAt": null
    }
  }
}
```

The retry is a full restart through the existing PDF parsing, chunking, and embedding pipeline. It keeps the same document ID, filename, owner, and storage reference; it does not resume from the failed stage or create another `Document`.

Missing, foreign-owned, and soft-deleted documents use the same `404 DOCUMENT_NOT_FOUND` response. `PENDING`, `PROCESSING`, `CHUNKS_READY`, `EMBEDDING`, and `READY` documents return `409 INVALID_DOCUMENT_STATE`. The atomic `FAILED` to `PROCESSING` transition prevents repeated requests from creating multiple jobs. If queue submission fails, the API attempts to restore the previous `FAILED` metadata and returns `503 PROCESSING_QUEUE_UNAVAILABLE`.

The protected Document Details frontend exposes Retry only for its validated public Failed state.
Opening or cancelling the confirmation sends no request. Confirmation sends only the encoded
document ID through the shared credentialed client and waits for the `202` response before changing
the UI. The complete returned DTO replaces the active Details resource on the same route and same
ID; the previous failure text disappears, Retry is hidden, and manual Refresh remains available.
No polling begins.

The frontend maps `PROCESSING_QUEUE_UNAVAILABLE` to safe retryable feedback while retaining the
Failed DTO. `DOCUMENT_NOT_FOUND` follows the shared neutral unavailable path. An
`INVALID_DOCUMENT_STATE` race closes the stale confirmation and performs exactly one Details
refresh with neutral status-changed feedback. The shared API client continues to own
`UNAUTHENTICATED` handling. Retry is coordinated locally with Delete and Refresh so mutations do
not overlap.

## Delete document

```http
DELETE /api/documents/:documentId
```

The owner-scoped update sets `deletedAt` before an identifier-only `document.delete` BullMQ job is submitted. A successful request returns `202 Accepted`:

```json
{
  "data": {
    "document": {
      "id": "document-id",
      "deletedAt": "2026-07-22T18:00:00.000Z"
    }
  }
}
```

The request does not delete object storage, chunks, or embeddings synchronously. Soft deletion immediately removes the document from list/detail responses and semantic retrieval. Missing, foreign-owned, and already deleted identifiers all return `404 DOCUMENT_NOT_FOUND`.

`202` confirms acceptance, not completed cleanup. An exhausted cleanup job can leave a hidden
row and original object. The database's `(userId, fileHash)` uniqueness covers soft-deleted rows
too, so that row can still cause `409 DUPLICATE_DOCUMENT` on an identical upload. Upload does not
resurrect or reuse it; successful hard cleanup removes this particular uniqueness blocker.

If cleanup queue submission fails, the API attempts to restore the exact soft-delete update and returns `503 DOCUMENT_DELETION_QUEUE_UNAVAILABLE`. Permanent cleanup deletes the private storage object first, then related chunk/vector data and the document row.

The protected Document Details frontend consumes this contract through the shared credentialed API
client. It validates only `id` and `deletedAt`, sends no owner or storage identifiers, and waits for
`202 Accepted` before leaving the page. The action requires an explicit confirmation and prevents
duplicate submission. Acceptance replaces navigation with `/documents` and announces that the
document is unavailable immediately while cleanup continues in the background; the frontend does
not poll worker state.

Opening or cancelling the dialog sends no request, and recoverable failures keep the current
details visible for an explicit retry. `DOCUMENT_NOT_FOUND` during confirmation is treated as one
neutral unavailable result, preserving the missing/foreign/already-deleted contract.
`DOCUMENT_DELETION_QUEUE_UNAVAILABLE` is shown as safe retryable feedback. `UNAUTHENTICATED`
continues through the shared session-expiration handler. Undo, Trash, Restore, and optimistic
removal are not part of this contract.

## Create a conversation

```http
POST /api/conversations
```

The endpoint requires authentication and does not require or accept a product request body.
Ownership comes from the HttpOnly authenticated session. A successful request returns `201
Created`:

```json
{
  "data": {
    "conversation": {
      "id": "conversation-id",
      "title": null,
      "createdAt": "2026-07-23T08:00:00.000Z",
      "updatedAt": "2026-07-23T08:00:00.000Z"
    }
  }
}
```

The Conversations Workspace never creates a local ID or optimistic row. It navigates with the
server-confirmed ID, resets list pagination to page one, and performs one controlled list refresh.

## List conversations

```http
GET /api/conversations?page=1&limit=20
```

The endpoint requires authentication and returns only non-deleted conversations owned by the authenticated user.

| Parameter | Default | Rules                           |
| --------- | ------- | ------------------------------- |
| `page`    | `1`     | Positive integer                |
| `limit`   | `20`    | Positive integer, maximum `100` |

Invalid pagination uses `400 INVALID_INPUT`. Conversations are ordered by `updatedAt DESC`, then `id DESC` for deterministic ties.

```json
{
  "data": {
    "conversations": [
      {
        "id": "conversation-id",
        "title": "JWT Authentication Basics",
        "preview": "How does JWT authentication work?",
        "createdAt": "2026-07-23T08:00:00.000Z",
        "updatedAt": "2026-07-23T08:01:00.000Z"
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

`preview` is derived only from the latest USER message. Whitespace is normalized and values longer than 80 characters are truncated at a safe word boundary. An empty new conversation or a conversation containing no USER message returns `preview: null`. Assistant content, citations, AI metadata, and ownership fields are not exposed.

After the first USER message and ASSISTANT response are saved successfully, the API reuses the existing chat generation abstraction to create a title of at most seven words from the first question. The title update is owner-scoped and applies only while `title` is null. Title generation is best-effort: provider or persistence failure does not fail or roll back the completed conversation turn, so `title` may remain null.

The frontend renders the backend order without client-side sorting. `title: null` uses the
non-persisted `New conversation` fallback and `preview: null` uses the non-persisted `No messages
yet` fallback.

## Get a conversation

```http
GET /api/conversations/:conversationId
```

The endpoint requires authentication and selects one active conversation by both ID and
authenticated owner. Missing, foreign-owned, and soft-deleted conversations return the same `404
CONVERSATION_NOT_FOUND` contract. Malformed route IDs use the existing `400 INVALID_INPUT`
validation behavior.

The successful `200 OK` response contains public conversation metadata and chronologically ordered
`USER` and `ASSISTANT` messages. Internal `SYSTEM` messages are never part of the public response:

```json
{
  "data": {
    "conversation": {
      "id": "conversation-id",
      "title": "JWT Authentication Basics",
      "createdAt": "2026-07-23T08:00:00.000Z",
      "updatedAt": "2026-07-23T08:01:00.000Z",
      "messages": [
        {
          "id": "user-message-id",
          "role": "USER",
          "content": "Where should I store a JWT?",
          "createdAt": "2026-07-23T08:00:30.000Z",
          "sources": []
        },
        {
          "id": "assistant-message-id",
          "role": "ASSISTANT",
          "content": "Use an HttpOnly cookie [S1].",
          "createdAt": "2026-07-23T08:01:00.000Z",
          "sources": [
            {
              "label": "S1",
              "documentId": "document-id",
              "documentName": "Authentication Guide.pdf",
              "chunkId": "chunk-id",
              "chunkPosition": 4,
              "page": 12
            }
          ]
        }
      ]
    }
  }
}
```

Messages are ordered by `createdAt ASC`, then `id ASC`. Current API-created public roles are only
`USER` and `ASSISTANT`; the frontend rejects any other role rather than exposing system prompts.
Every detail message contains a `sources` array. USER and insufficient-context messages use an
empty array. The response excludes ownership, prompts, retrieval queries, AI metadata, vector
values, scores, and database relations.

For an ASSISTANT source, `label` follows the backend `S1`, `S2`, … convention and `page` is either a
positive integer or `null`. The frontend rejects malformed source responses instead of guessing a
display value. It preserves source order and duplicates, displays the label once as `[S#]`, the
server-provided document name, and an optional page, then links to the encoded internal
`/documents/:documentId` route. `chunkId` and `chunkPosition` remain contract fields but are not
displayed. USER messages never render source cards.

## Create a conversation message

```http
POST /api/conversations/:conversationId/messages
Content-Type: application/json

{
  "content": "Where should I store it?"
}
```

The endpoint requires authentication and accepts only an active conversation owned by the authenticated user. Missing, foreign-owned, and soft-deleted conversations use the same `404 CONVERSATION_NOT_FOUND` response.

`content` must be a string. The API applies JavaScript `trim()`, rejects empty or whitespace-only
content, and accepts at most 4,000 characters after trimming. The frontend applies the identical
rule before submission but the API remains authoritative. No conversation history, owner ID,
document ID, model option, title, preview, or citation data is accepted from the browser.

Before retrieval, the API loads at most the six most recent prior USER/ASSISTANT messages from that conversation, excluding the new current message. The serialized history is limited to 6,000 characters; when either limit is exceeded, the oldest messages are discarded first. Missing assistant messages and empty history are valid.

Recent history and the current question form a context-aware retrieval query so follow-up references can be understood. The same history is passed to answer generation in a section separate from retrieved document context. History is dialogue context only: it is not a trusted factual source, cannot be cited, and cannot replace owner-scoped chunks from non-deleted `READY` documents. No cross-conversation or long-term memory is used.

The successful `201 Created` response keeps the existing turn contract:

```json
{
  "data": {
    "message": {
      "id": "assistant-message-id",
      "role": "ASSISTANT",
      "content": "Use an HttpOnly cookie when...",
      "createdAt": "2026-07-23T08:02:00.000Z"
    },
    "sources": [
      {
        "label": "S1",
        "documentId": "document-id",
        "documentName": "Authentication Guide.pdf",
        "chunkId": "chunk-id",
        "chunkPosition": 4,
        "page": 12
      }
    ]
  }
}
```

The response contains only the newly persisted ASSISTANT message and its safe source DTOs. It does
not contain the persisted USER message, updated conversation, generated title, or list preview.
The frontend therefore performs one owner-scoped `GET /api/conversations/:conversationId` after a
successful POST and one page-one list refresh. It retains server IDs, timestamps, roles, title,
preview, and ordering rather than constructing any of them locally.

The answer-generation prompt requires plain-text output and forbids Markdown and HTML presentation
syntax. Grounding labels such as `[S1]` are still expected in the answer, while the structured
`sources` array remains the authoritative UI contract for citation cards. The browser displays
assistant content as untrusted text and never interprets it as markup.

If retrieval returns no chunks, the endpoint still returns `201 Created` with the normal
ASSISTANT message content `The available documents do not contain enough information to answer
this question.` and an empty `sources` array. The frontend renders it as an ordinary assistant
message and does not infer this state through string matching.

The USER message is persisted before retrieval. On retrieval, provider, response-validation, or
ASSISTANT-persistence failure, the service best-effort deletes that USER message before returning a
safe public error. Because compensation can itself fail, the frontend performs one controlled
detail reload after ambiguous failures. If authoritative history contains a new matching USER
message, the draft is cleared to avoid encouraging a duplicate; otherwise the draft is preserved
for an explicit retry. The frontend never automatically resends.

Relevant public errors include:

- `400 INVALID_INPUT` for malformed, empty, or over-limit content;
- `401 UNAUTHENTICATED` through centralized session-expiration handling;
- `404 CONVERSATION_NOT_FOUND` for missing, foreign-owned, or soft-deleted conversations;
- `500 RETRIEVAL_FAILED` or `500 MESSAGE_PERSISTENCE_FAILED`;
- `502 INVALID_AI_RESPONSE`;
- `503 EMBEDDING_PROVIDER_UNAVAILABLE`, `EMBEDDING_CONFIGURATION_MISMATCH`, or
  `AI_PROVIDER_UNAVAILABLE`.

Phase 11.7C renders validated source cards only from the persisted ASSISTANT messages returned by
the authoritative detail reload. It does not synthesize citations from answer text or treat the
POST response as canonical history. Source navigation opens the existing owner-scoped Document
Details page; original-PDF viewing, download, and deep page anchors are not provided. This
non-streaming endpoint does not itself support polling, WebSockets, Markdown, regeneration, editing,
or attachments. Streaming is available through the separate endpoint documented next; the product's
Threads UI calls that one, not this one.

## Stream a conversation message (SSE)

```http
POST /api/conversations/:conversationId/messages/stream
Content-Type: application/json

{
  "content": "Where should I store it?"
}
```

Same authentication, ownership, CSRF, email-verification, and `content` validation as
`POST /messages` above -- including the identical `404 CONVERSATION_NOT_FOUND` response for missing,
foreign-owned, or soft-deleted conversations, and the same relevant public errors, all returned as a
normal (non-SSE) JSON error response. That is deliberate: the connection is only switched into
`text/event-stream` mode after the first event from the underlying turn has already been produced
successfully, so every rejection above happens before any SSE framing exists.

Once the first event is ready, the response is `200 OK` with `Content-Type: text/event-stream;
charset=utf-8`, `Cache-Control: private, no-cache, no-store, must-revalidate`, and
`Connection: keep-alive`. Each frame is `event: <type>\ndata: <json>\n\n`. A successful turn emits,
in order:

| Event | Payload | Meaning |
| --- | --- | --- |
| `user_message` | `{ type, message: { id, role, content, createdAt } }` | The persisted USER message, sent immediately so the client can render it without waiting on retrieval. |
| `status` | `{ type, phase: "retrieving" }` | Retrieval has started. |
| `status` | `{ type, phase: "generating" }` | Retrieval finished; generation has started. |
| `delta` | `{ type, delta: string }` | One or more incremental chunks of answer text, in order. An insufficient-context turn (zero retrieved chunks) still emits exactly one `delta` carrying the fixed answer text, with no live provider call. |
| `completed` | `{ type, result: { message, sources } }` | The persisted ASSISTANT message and source DTOs -- the same shape `POST /messages` returns in its `data` field. |

If the browser disconnects before `completed`, the server aborts the in-flight turn; the AI-budget
reservation is still settled (conservatively) rather than left open, matching the non-streaming
endpoint's best-effort USER-message compensation on failure. If an unexpected failure happens after
the first event was already written, one final `event: error` frame is sent
(`{ code, message, status }`, matching the shape of the JSON errors listed above) before the
connection closes; no raw error detail is ever included in that frame or logged.

See docs/architecture.md's "Conversation streaming (SSE)" section for the full flow diagram and the
heartbeat/idle-timeout analysis (no heartbeat is sent today; the current gaps between events are
well inside Railway's SSE idle-close window).
