# Developer Knowledge Hub

A full-stack knowledge workspace for developers. Upload technical PDFs, let a background worker index them, then ask questions and get answers grounded in your own documents with source citations.

Built as a portfolio project to demonstrate how product UX, secure APIs, asynchronous processing, vector search, and AI fit together in one working system.

## What it does

- Creates a private, owner-scoped document library with PDF upload, search, status filters, and document details.
- Extracts and chunks PDF text in background jobs, generates embeddings, and stores them in PostgreSQL with pgvector.
- Streams answers in Threads using relevant document passages as evidence, with citations linked back to document details.
- Supports email-verified accounts, revocable sessions, document retry and deletion, usage limits, and AI cost controls.

The current MVP serves individual developers. It accepts text-based PDFs; it does not yet display or download the original PDF in the UI.

## How it works

```text
React web app → Express API → PostgreSQL + pgvector
                    │
                    ├─→ Redis / BullMQ → PDF and embedding worker
                    ├─→ private PDF storage (local or Cloudflare R2)
                    └─→ OpenAI through application-owned provider interfaces
```

The browser talks only to the API. Retrieval is restricted to the signed-in user's ready documents; conversation history may clarify a follow-up question but never serves as factual evidence. Answers and citation snapshots are persisted with their conversation.

## Engineering highlights

| Area               | Implementation                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Authentication     | HttpOnly server-side sessions, email verification, CSRF and Origin checks, owner-scoped queries                        |
| Document lifecycle | BullMQ processing, embedding, retry, and cleanup jobs with explicit states and bounded PDF parsing                     |
| Grounded AI        | pgvector retrieval, source-labelled context, streamed answers, persisted citations, and an application-level AI budget |
| Production setup   | Five Railway services (Web, API, Worker, PostgreSQL, Redis), same-origin API proxy, Cloudflare R2, and Resend          |
| Quality            | TypeScript contracts, API and worker tests, frontend regression tests, and documented architecture decisions           |

The interface uses the dark V4 design across Sign In, Overview, Documents, Document Details, and Threads. Its design decisions are recorded in the [design manifesto](docs/design-manifesto.md).

## Run locally

Requires Node.js 22, npm 10, Docker Compose, and an OpenAI API key. Local PDF storage and console-based verification email are the development defaults.

```bash
npm install
cp .env.example .env
# Set the local PostgreSQL password and OPENAI_API_KEY in .env
npm run dev:infra
npm run prisma:generate
npm run prisma:migrate:deploy
npm run dev:apps
```

`npm run dev:infra` starts PostgreSQL and Redis; `npm run dev:apps` starts the Web, API, and Worker. After initial setup, `npm run dev` starts the full local stack. Open `http://localhost:5173`. See [deployment notes](docs/deployment.md) for the production topology and configuration.

## Where to look next

- [Product scope](docs/product-scope.md) — supported use cases and deliberate MVP limits.
- [Architecture](docs/architecture.md) — system boundaries and document/RAG data flow.
- [API contract](docs/api.md) — endpoints, response shapes, and error behavior.
- [Security](docs/security.md) — sessions, ownership, upload handling, and abuse controls.
- [Technical documentation](docs/technical-documentation.md) — deeper implementation and verification notes.
- [Architecture decisions](docs/decisions/) — why the main technologies and boundaries were chosen.

The five-service Railway flow was exercised in August 2026; the [deployment notes](docs/deployment.md) distinguish confirmed behavior from remaining operational checks. A hosted demo is not guaranteed to be available while the portfolio environment is paused.
