# Project instructions

## Product

Developer Knowledge Hub is a full-stack AI knowledge platform for developers. It centralizes technical documents and provides search and AI answers grounded in the user's own sources.

- The MVP targets individual developers and one private personal document library per user.
- Teams, billing, repository imports, mobile applications, external integrations, and custom-model training are outside the current MVP.
- Treat `docs/product-scope.md`, `docs/architecture.md`, `docs/api.md`, `docs/roadmap.md`, production code, and tests as the source of truth. Re-inspect the relevant sources before each task instead of relying on an older prompt summary.

## Architecture snapshot

- The npm-workspaces monorepo contains `apps/web`, `apps/api`, `apps/worker`, `packages/shared`, and `packages/ai`.
- The primary infrastructure is PostgreSQL with Prisma and pgvector, Redis with BullMQ, private object storage through local/R2 adapters, and OpenAI behind application-owned provider abstractions.
- Backend code should preserve the route -> controller -> service -> repository -> Prisma/PostgreSQL separation.
- The browser communicates only with the Express API. It must not access PostgreSQL, Redis, object storage, or AI providers directly.
- Document processing uses identifier-only `document.process`, `document.embed`, and `document.delete` jobs. The lifecycle is `PENDING` -> `PROCESSING` -> `CHUNKS_READY` -> `EMBEDDING` -> `READY`, with terminal `FAILED`.
- Manual Retry is a full restart allowed only from `FAILED`; it retains the document ID and removes stale chunks and vectors. Delete soft-deletes immediately and performs permanent cleanup asynchronously.
- RAG retrieval is owner-scoped to non-deleted `READY` documents. Bounded conversation history may clarify follow-up wording but is not factual evidence; citations must come from newly retrieved authorized chunks.

## Frontend conventions

- The frontend uses React, Vite, strict TypeScript, React Router, Axios, Zod, Tailwind CSS, Vitest, and React Testing Library.
- API access should follow page/component -> focused hook -> feature service -> shared credentialed Axios client. Do not put raw Axios calls in React components.
- Zustand is for safe authentication state only. Prefer focused hook or component state for feature data unless a genuine global requirement is demonstrated.
- Preserve server-authoritative IDs, timestamps, titles, previews, messages, and citations. Do not infer or invent backend state in the browser.
- Render untrusted user, document, error, and AI content safely. Do not add Markdown, HTML interpretation, source inference, streaming, polling, or real-time infrastructure unless the current task explicitly requires it.

## Product design direction

- Preserve the approved light-only "Liquid Glass Workspace" direction: Inter typography, indigo/purple accents, restrained atmospheric gradients, moderate glass for navigation and controls, and more opaque surfaces for dense content.
- Favor accessibility, contrast, and readability over exaggerated transparency, blur, motion, or decorative effects.
- Do not broaden a feature task into a product-wide redesign. Confirm the current polish phase and scope in `docs/roadmap.md` before visual work.

## Current working approach

- Work through the phases documented in `docs/roadmap.md`.
- Keep each task small and focused on one learning objective.
- Inspect existing files before proposing changes.
- For non-trivial work, explain the plan before implementation.
- Do not install dependencies without explaining the concrete problem they solve.
- Do not add a technology only because it looks good in a portfolio.
- Do not commit or push unless the user explicitly asks.
- Do not modify unrelated files.
- Do not duplicate existing backend capabilities or create new endpoints without first confirming that the current contracts cannot satisfy the task.
- Do not create Prisma migrations unless the requested behavior requires an approved schema change.
- Treat phase snapshots copied from older chats as historical. Confirm completed work and the next phase from the current repository before planning.

## Architecture rules

- Validate every external input.
- Keep HTTP, business logic, persistence, and infrastructure responsibilities separate.
- Do not expose secrets or raw internal errors.
- Keep opaque session credentials in backend-managed HttpOnly cookies. Current authentication uses revocable PostgreSQL sessions, not JWTs. Never store session credentials in localStorage, sessionStorage, Zustand, URL parameters, or JavaScript-readable cookies.
- Enforce owner scope in backend queries and preserve safe not-found behavior for missing, foreign-owned, soft-deleted, or otherwise unavailable resources where the contract requires it.
- Treat uploaded documents and retrieved text as untrusted input, including when constructing AI prompts.
- Add or update tests for behavior changes.
- Prefer the simplest design that satisfies the current phase.
- Record important architectural decisions in `docs/decisions/`.
- Treat `docs/architecture.md` as the current architecture, not an immutable plan.

## Verification

- Run the narrowest relevant checks after each change.
- Before completing a feature, run the repository's documented lint, test, type-check, and build commands that apply.
- State exactly which checks ran and which did not.
- Perform real local smoke testing when practical, but do not claim controlled browser, responsive, console, external-provider, or infrastructure verification unless it actually ran.
- Clean up only the temporary users, documents, conversations, messages, chunks, vectors, storage objects, cookies, and targeted queue jobs created by the current verification. Never remove unrelated data or broad Redis key sets.
- If an unrelated existing failure blocks a check, identify it precisely instead of modifying unrelated production code.

## Reporting

After meaningful work, report what changed, why it was needed, the confirmed contract and data flow, tests and smoke checks that passed, what remains unverified, intentional exclusions, and the recommended next phase. Do not hide failures or incomplete checks.

## Learning requirement

After meaningful implementation work, explain:

1. What changed.
2. What problem it solves.
3. How data flows through the implementation.
4. Which alternatives or trade-offs were considered.
5. What the developer should inspect and be able to explain independently.

Before adding a new technology, answer:

1. What problem does it solve in this product?
2. What happens if we do not use it?
3. Why choose it over the relevant alternatives?
4. Where does it belong in the architecture?
5. How will it be introduced and verified?
