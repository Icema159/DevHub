# UR-001A — Chat-only Dark V4.2 implementation experiment

- **Author role:** Codex — Implementation Engineer
- **Status:** `PROMOTED_TO_PRODUCTION_THREADS`
- **Implementation date:** 2026-08-29
- **Decision source:** `decision.md` — `APPROVED FOR V4.1 EVALUATION IMPLEMENTATION`

## Production Threads rollout — 2026-09-01

The human approved promoting the existing Chat Dark V4 presentation to the real application. The
production `/chat` and `/chat/:conversationId` routes now use the approved V4 identity and the
user-facing `Threads` terminology. The development-only experiment routes were removed so there is
one visual source of truth.

This rollout preserves the existing owner-scoped conversation hooks, API contracts, sending,
pagination, loading, error, and source-link behavior. The compact V4 Composer and avatar-free
assistant presentation were separated from the experiment-only message-local citation interaction;
that citation interaction remains excluded from production until it receives separate behavioral
approval.

## V4.1 → V4.2 rapid iteration delta

V4.2 keeps the V4.1 dark workspace and message-local citation interaction intact while applying
the requested calibration from the supplied A/B reference: the desktop Sidebar and workspace are
treated as one centered composition, the workspace is shorter with a narrower conversation rail,
and a route-local `Threads` heading now sits above it. Conversation rows use less padding and
decoration, the experiment Composer is thinner with a circular send control, and shared glass
edge treatments are softened into selective ambient highlights rather than uniform borders.

The default `/chat` route, backend/API contracts, real conversation data flow, citation behavior,
and package manifests remain unchanged.

## V4.2 → V4.3 rapid iteration delta

The human-approved V4.2 composition and source-receipt treatments remain intact. V4.3 removes the
remaining desktop rail-to-chat gutter, gives long-form answers a narrower reading measure, removes
the experiment-only assistant avatar, and makes inline citation markers smaller without changing
their message-local keyboard, pointer, touch, focus, or source-navigation behavior. Chrome surfaces
now use lower-opacity layered fills and restrained inset highlights so the existing aurora contributes
to the Sidebar, workspace, header, and Composer while the knowledge surface stays near-opaque.

The Chat pane keeps a constrained flex column with the messages region as its only vertical scroll
owner and the Composer as a non-scrolling bottom sibling. No backend, API, data, or package changes
were made.

## Isolation architecture

The experiment reuses the existing Chat page and real application pipeline through two
development-only routes:

- `/experiments/chat-dark-v4`
- `/experiments/chat-dark-v4/:conversationId`

The routes are registered only when `import.meta.env.DEV` is true. They are not present in the
primary navigation and the production bundle does not contain the experiment path. `ChatPage`
accepts a small `routeBasePath` seam so internal list, create, selected-conversation, pagination,
and mobile-back navigation stay inside the selected route without duplicating Chat business logic.

The existing `/chat` and `/chat/:conversationId` routes retain their default base path and visual
identity.

## Existing behavior reused

- authenticated owner-scoped conversation list and direct conversation loading;
- server-authoritative conversation IDs, titles, previews, timestamps, messages, and citations;
- existing conversation creation and message submission hooks;
- authoritative refresh and stale-response protection;
- loading, error, empty, insufficient-context, disabled, and submitting behavior;
- current citation links and document routes;
- current three ambient light fields, keyboard semantics, focus system, and reduced-motion rules.

No fake conversations, citations, timestamps, processing metrics, or model metadata were added.

## Visual concepts implemented

- near-black navy canvas with restrained blue, cyan, violet, and pink atmospheric fields;
- darker translucent navigation, conversation rail, workspace frame, header, and composer dock;
- route-scoped blue primary action and cyan evidence/source identity;
- restrained selected, hover, active, focus, skeleton, alert, and empty-state treatments;
- high-contrast blue user messages;
- near-opaque assistant answer surfaces so glass surrounds knowledge rather than reducing reading
  contrast;
- lightweight receipt rows with cyan source labels and explicit non-color text labels;
- message-local citation-to-receipt hover, focus, click, keyboard, touch, and reduced-motion behavior;
- more opaque mobile glass and the existing no-animation reduced-motion path;
- solid dark fallback colors before optional `backdrop-filter` enhancement.

## Deliberately excluded prototype concepts

- no product-wide dark theme or theme switcher;
- no Dashboard, Documents, Document Details, or Auth redesign;
- no fake telemetry, counts, usage metrics, fragment details, or pipeline metadata;
- no cross-message citation lookup, Markdown/HTML interpretation, or arbitrary rich-text rendering;
- no new animation library, pointer tracking, animated filters, or additional ambient fields;
- no backend, API, RAG, Worker, Prisma, database, session, CSRF, or dependency changes.

## Files changed for the experiment

- `apps/web/src/app/router.tsx`
- `apps/web/src/components/layout/AppShell.tsx`
- `apps/web/src/features/conversations/pages/ChatPage.tsx`
- `apps/web/src/features/conversations/components/ConversationsWorkspace.tsx`
- `apps/web/src/features/conversations/components/ConversationList.tsx`
- `apps/web/src/features/conversations/components/ConversationListItem.tsx`
- `apps/web/src/features/conversations/components/SelectedConversationShell.tsx`
- `apps/web/src/features/conversations/components/ConversationThread.tsx`
- `apps/web/src/features/conversations/components/ConversationWorkspaceEmptyState.tsx`
- `apps/web/src/features/conversations/components/MessageComposer.tsx`
- `apps/web/src/components/composed/ChatMessage.tsx`
- `apps/web/src/components/composed/CitationSource.tsx`
- `apps/web/src/components/composed/AssistantAnswerWithSources.tsx`
- `apps/web/src/components/composed/AssistantAnswerWithSources.test.tsx`
- `apps/web/src/styles/globals.css`
- relevant frontend route and Chat tests;
- this UR-001 task documentation.

Most component changes add semantic class hooks or pass the route base path and an explicit
experiment-only interaction flag; default rendering and contracts are unchanged. The production
bundle contains the shared semantic class name but not the development-only experiment route path.

## Final verification

- real authenticated conversation and citation data rendered in both the default and experimental
  route;
- the first experiment capture exposed overly light source receipts and composer surfaces; those
  styles were corrected only inside `.chat-dark-v4-identity`;
- the final 1440 × 900 controlled-browser capture was reviewed after the V4.1 calibration;
- prior V4 responsive/state captures remain available as historical evidence, while a fresh V4.1
  1280 × 800, 1024 × 768, 390 × 844, reduced-motion, fallback, and state matrix is pending because
  the browser runtime reached its usage limit during this turn;
- the default Chat remained light and did not receive the experiment identity class;
- no horizontal overflow, React page error, or application console error was observed; the only
  console error was an unrelated development-only missing `/favicon.ico` request at 1440 × 900;
- direct source-to-implementation comparison was captured in
  `output/ur-001a-chat-dark-v4/source-implementation-comparison.png`;
- `npm run test:web` — 32 files, 317 tests passed;
- `npm run typecheck:web` — passed;
- `npm run lint:web` — passed;
- `npm run format:check --workspace @developer-knowledge-hub/web` — passed;
- `npm run build:web` — passed, with only the existing bundle-size warning;
- production JavaScript bundle check — experiment route path absent;
- `git diff --check` — passed.

The controlled in-app browser was used for the current 1440 × 900 visual check. A fresh browser
matrix could not be completed after the browser runtime denied further localhost inspection because
of the account usage limit. No Playwright package was installed and no package manifest changed.

## Local access

With the normal local development services running and an authenticated session, open:

`http://localhost:5173/experiments/chat-dark-v4`

Choose any existing real conversation. The normal comparison surface remains:

`http://localhost:5173/chat`

## Complete removal

1. Remove the two conditional experiment routes from `apps/web/src/app/router.tsx`.
2. Remove experiment-route detection and `chat-dark-v4-identity` assignment from
   `apps/web/src/components/layout/AppShell.tsx`.
3. Remove the `.chat-dark-v4-identity` CSS blocks.
4. If no future alternate route needs it, remove the `routeBasePath` props and restore the constant
   `/chat` links.
5. Remove the experiment-specific route tests and this experiment record.

No migration, dependency rollback, backend cleanup, or data cleanup is required.

## Known limitations

- Chat alone can judge first impression and knowledge-workspace identity, but cannot approve a
  product-wide dark theme.
- The current browser evidence is complete for the calibrated 1440 × 900 state only; responsive,
  fallback, reduced-motion, and edge-state captures need one fresh browser pass before visual sign-off.
- The browser-verified example contains real local user data and is not a reusable visual fixture.
- The experiment remains development-only and is evidence for a future design decision, not an
  approval to roll Dark V4 out product-wide.
