# UR-001 — Current-state feasibility review

- **Author role:** Codex — Implementation Engineer
- **Status:** `READY_FOR_REVIEW`
- **Reviewed artifact and revision:** `task.md` dated 2026-08-27; independent first pass
- **Review date:** 2026-08-29
- **Production-code changes made:** No

## Verdict

`CHANGES_REQUESTED`

**AGREE — Preserve** is feasible now and is the recommended outcome on the evidence inspected.

**AGREE WITH CONDITIONS — Bounded calibration** is technically feasible only after a concrete,
observable problem and desired user outcome are named. The smallest safe boundary is a light-theme
token/material calibration proved in `/ui-kit` and one representative existing surface. It must not
change component behavior, data contracts, routes, state machines, or the five accepted material
roles.

**BLOCKER — Broader redesign** is not ready to advance. Dark aurora, neon/glowing AI identity,
additional animated effects, translucent knowledge surfaces, and unsupported prototype metrics
conflict with the explicit UR-001 scope, the frozen Phase 12 decision, or current API contracts.
They require a new human decision and, for some concepts, separate product/backend tasks.

This verdict does not reject future design work. It rejects treating a new product-wide direction
as an authorized visual calibration without evidence, cross-review, and human approval.

## Evidence inspected

- `AGENTS.md`
- `docs/design-manifesto.md`
- `docs/roadmap.md`
- `docs/api.md`
- `docs/ui-redesign/README.md`
- `docs/ui-redesign/protocol.md`
- `docs/ui-redesign/roles.md`
- `docs/ui-redesign/decision-workflow.md`
- `docs/ui-redesign/templates/review-template.md`
- `docs/ui-redesign/tasks/UR-001-liquid-glass-foundation/task.md`
- `docs/ui-redesign/tasks/UR-001-liquid-glass-foundation/README.md`
- `docs/ui-redesign/tasks/UR-001-liquid-glass-foundation/design-proposal.md`
- `apps/web/package.json`
- `apps/web/src/app/router.tsx`
- `apps/web/src/app/route-guards.tsx`
- `apps/web/src/components/layout/AppShell.tsx`
- `apps/web/src/components/layout/AppSidebar.tsx`
- `apps/web/src/components/layout/AmbientLightLayer.tsx`
- `apps/web/src/components/ui/*` and `apps/web/src/components/composed/*`
- Dashboard, Documents, Document Details, Conversations, and Authentication pages, components,
  hooks, schemas, services, types, and relevant tests under `apps/web/src/features/*`
- `apps/web/src/pages/UiKitPage.tsx`
- `apps/web/src/styles/globals.css`
- Relevant public DTO construction and owner-scoped queries under `apps/api/src/services/*` and
  `apps/api/src/repositories/*`
- `prisma/schema.prisma` and the relevant Worker document-processing persistence path

The review used source code, tests, and recorded prior acceptance as evidence. No controlled-browser
or live-provider verification was performed for this documentation-only first pass.

## 1. Current frontend architecture summary

### Runtime and routing

The frontend is React 19 + Vite + strict TypeScript with Tailwind CSS 4, React Router, Axios, Zod,
Zustand for authentication state, Vitest, and React Testing Library. No new styling or animation
dependency is needed for any safe calibration.

`apps/web/src/app/router.tsx` defines:

- public `/login` and `/register` routes inside `AuthLayout`;
- `/verify-email` inside the same authentication shell;
- protected `/dashboard`, `/documents`, `/documents/:documentId`, `/chat`, and
  `/chat/:conversationId` routes inside `AppShell`;
- `/ui-kit` as the existing design-system preview surface.

`AppShell` is the global identity seam. It attaches route-scoped `chat-identity`,
`dashboard-identity`, and `documents-identity` classes, renders one decorative
`AmbientLightLayer`, owns the desktop Sidebar and mobile navigation dialog, and leaves feature
content to the route outlet. `AuthLayout` remains a separate unauthenticated composition.

### Shared visual system

`apps/web/src/styles/globals.css` already centralizes:

- semantic color, typography, radius, elevation, glass, and focus tokens;
- Navigation, Workspace, Interaction, Solid Knowledge, selected, and route-specific materials;
- supported-browser backdrop blur/saturation with opaque base fallbacks;
- three slow transform-only ambient light fields;
- mobile opacity calibration and reduced-motion behavior.

`Card` maps semantic variants to those material roles. Button, IconButton, Input, SearchInput,
Select, Alert, StatusBadge, Modal, Pagination, Skeleton, EmptyState, Toast, SidebarNavItem,
ChatMessage, CitationSource, and DocumentRow provide reusable behavior and state language. The
system is already a production foundation, not a blank prototype layer.

### Feature composition and existing states

- **Dashboard:** real document status overview, recent documents, recent conversations, failed
  document attention, onboarding for an empty knowledge base, and independent loading/error/empty
  states. Its two primary actions are links, not embedded upload/chat workflows.
- **Documents:** debounced filename search, grouped status filter, refresh, PDF upload dialog,
  paginated list, and distinct no-documents/no-results/no-status-match states. It becomes a table at
  1280 px and stays a semantic compact list below that boundary.
- **Document Details:** loading, generic unavailable, recoverable error, refresh error, Ready,
  grouped Processing, Failed, Retry dialog, and Delete dialog. Dense knowledge and decisions are
  near-opaque.
- **Chat:** backend-authoritative pagination, server-created conversations, selected-thread reads,
  persisted messages, message submission, authoritative refresh, nullable citation pages, and
  separate list/thread navigation below 1280 px. Answers remain inert plain text; citations are
  separate accessible document links.
- **Authentication:** session bootstrap loading/error, Login, Register, email verification, resend
  notice, validation, submission, and safe server-error states. It uses a separate responsive shell.

### State ownership

Page/component -> focused hook -> feature service -> shared credentialed API client is preserved.
Resource unions distinguish loading, success, error, not-found, refresh, and mutation states. A
visual task must retain these hooks and state transitions rather than duplicating them in new
presentation components.

## 2. Real-data availability matrix

| Prototype information                  | Classification                                                  | Current evidence and safe interpretation                                                                                                                                                                                                                                            |
| -------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Total document count                   | **AVAILABLE NOW**                                               | `meta.statusCounts.all` is owner-scoped and excludes soft-deleted rows. `meta.total` follows the active status/search query, so the two must not be relabelled interchangeably.                                                                                                     |
| Indexed count                          | **AVAILABLE NOW, WITH VOCABULARY CONDITION**                    | Can be shown only as `READY` / “Ready for AI search.” It must not imply lower-level vector-index health.                                                                                                                                                                            |
| Processing count                       | **AVAILABLE NOW**                                               | Backend groups `PENDING`, `PROCESSING`, `CHUNKS_READY`, and `EMBEDDING` into the public processing count.                                                                                                                                                                           |
| Failed count                           | **AVAILABLE NOW**                                               | Exposed in owner-scoped `statusCounts.failed`.                                                                                                                                                                                                                                      |
| Recent documents                       | **AVAILABLE NOW**                                               | Dashboard requests page 1, limit 5; backend ordering is `createdAt` then `id`, descending.                                                                                                                                                                                          |
| Recent conversations                   | **AVAILABLE NOW**                                               | Dashboard requests page 1, limit 5; backend supplies title, latest USER preview, timestamps, and authoritative ordering.                                                                                                                                                            |
| Page count                             | **REQUIRES BACKEND/WORKER/API CHANGE; SHOULD NOT BE FAKED**     | Parser knows pages during processing, but Document does not expose or reliably persist a public page count. Nullable citation page is not document page count.                                                                                                                      |
| Chunk / fragment count                 | **REQUIRES BACKEND/API CHANGE; SHOULD NOT BE FAKED**            | Chunk rows exist internally, but no public owner-scoped aggregate is exposed.                                                                                                                                                                                                       |
| Vector dimensions                      | **NOT CURRENTLY SUPPORTED FOR PRODUCT UI; SHOULD NOT BE FAKED** | Stored internally per chunk and currently 1,536, but deliberately excluded from public document DTOs. Exposing it requires a contract decision and is likely an operator/debug concern.                                                                                             |
| Embedding model                        | **NOT CURRENTLY SUPPORTED FOR PRODUCT UI; SHOULD NOT BE FAKED** | Stored/known internally but deliberately excluded from public DTOs. Do not hardcode the current environment value into UI.                                                                                                                                                          |
| Processing timestamps                  | **PARTIALLY AVAILABLE NOW**                                     | `createdAt`, generic `updatedAt`, and nullable terminal `processedAt` exist. Per-stage queued/started/chunked/embedding timestamps are not persisted or exposed; `updatedAt` must not be relabelled as a stage event.                                                               |
| Document lifecycle stages              | **DERIVABLE WITHOUT BACKEND CHANGE, WITH LIMITS**               | Raw API state contains six states. Current frontend intentionally maps four active states to one Processing state. A categorical current-stage view could retain the raw state, but no percentage, failed stage, stage history, stage timestamp, or queue position may be inferred. |
| Answers backed by a document           | **REQUIRES BACKEND/API CHANGE; SHOULD NOT BE FAKED**            | Internal message-source relations exist, but no public owner-scoped aggregation or deleted-conversation counting rule exists.                                                                                                                                                       |
| Threads using a document               | **REQUIRES BACKEND/API CHANGE; SHOULD NOT BE FAKED**            | Same contract and semantic-definition gap as answer count.                                                                                                                                                                                                                          |
| Citation IDs                           | **AVAILABLE NOW, WITH DISPLAY LIMIT**                           | Message-local `S#` labels, document ID, chunk ID, and position are returned. UI should show the source label; opaque chunk IDs are not user-facing product metadata.                                                                                                                |
| Citation document name                 | **AVAILABLE NOW**                                               | Persisted citation snapshot `documentName`; render as inert text.                                                                                                                                                                                                                   |
| Citation page number                   | **AVAILABLE NOW, NULLABLE**                                     | Show only when non-null. Never invent page 1 or another fallback.                                                                                                                                                                                                                   |
| Insufficient-context / answer-withheld | **BEHAVIOR AVAILABLE; SEMANTIC UI STATE NOT SUPPORTED**         | Backend persists an exact canonical assistant answer with no sources. There is no discriminator or reason field. Treating every empty-source answer as “withheld” is incorrect; exact-text matching would be brittle. A dedicated visual state needs an API contract change.        |

Additional boundaries:

- **CONCERN:** A large Dashboard ask/search input is not current Dashboard behavior. Existing APIs
  could support a separately designed create-conversation-and-send flow, but a decorative input
  would be fake and an operational input would be a new product feature.
- **CONCERN:** Current processing UX is manual refresh, not live progress. Do not add animation that
  suggests polling or a known percentage.
- **AGREE:** Citation cards already support safe navigation to owner-scoped Document Details.
  Original PDF/page viewing is not supported.
- **ALTERNATIVE:** Literal `[S#]` markers could theoretically be tokenized without Markdown, but
  citation-to-answer-span linking is not a CSS-only change and is not reliable enough for UR-001.
  A future structured answer-span contract is safer.

## 3. Technical feasibility findings

### Concept-by-concept assessment

- **BLOCKER — Dark aurora background:** CSS can render it, but this is not a technical calibration.
  Current tokens and many deliberate `white/*`, slate, and light semantic fills form a light-only
  system. A real dark direction requires product-wide token, contrast, knowledge-surface, semantic,
  fallback, and QA work. It is explicitly out of UR-001 scope.
- **AGREE / ALREADY EXISTS — Backdrop blur and saturation:** Existing `@supports` rules apply
  guarded 12–28 px effects with readable opaque defaults. Preserve fallback-first behavior.
- **AGREE WITH BOUNDARY — Translucent glass panels:** Reuse current Navigation, Workspace, and
  Interaction roles only. Do not move answers, citations, metadata, lifecycle facts, tables, or
  destructive decisions onto highly translucent surfaces.
- **AGREE / ALREADY EXISTS — Subtle edge highlights:** Existing masked pseudo-elements provide
  localized asymmetric highlights. They are decorative; focus and component boundaries must not
  depend on them. Avoid continuous blue-purple borders.
- **AGREE / ALREADY EXISTS — Shadows/depth:** Three shared elevation levels exist. More shadow fog
  would reduce hierarchy clarity and increase paint cost.
- **AGREE ONLY AS CURRENT IMPLEMENTATION — Animated background orbs:** Exactly three inert,
  `aria-hidden`, transform-only fields already move on 34–43 second cycles. Do not add count,
  mouse-follow, pulsation, animated filters, per-card orbs, or particles.
- **AGREE / ALREADY EXISTS — Responsive Sidebar:** Fixed desktop navigation at 1024 px and a native
  dialog drawer below it already handle focus, Escape, restoration, and breakpoint closure.
- **AGREE / ALREADY EXISTS — Status pills:** Icon + text + contained semantic color are reusable and
  tested. Color must not become the only signal.
- **CONCERN — Large Dashboard ask/search input:** New feature, not restyling; requires separate
  product approval and behavior specification.
- **ALTERNATIVE — Cyan citation markers:** A small color calibration is technically easy, but cyan
  should not replace the message-local label, filename, optional page, focus state, or established
  indigo language without human approval.
- **CONCERN — Citation hover/click linking:** Current answer text and sources are separate data. Safe
  whole-card links exist. Inline relationship highlighting needs an approved structured/tokenized
  renderer and keyboard/touch equivalence, not hover-only CSS.
- **CONCERN — Richer document details:** Layout is feasible; proposed metrics are not. Use only the
  current DTO unless a separately approved backend contract adds fields.
- **AGREE WITH LIMITS — Pipeline visualization:** Categorical current stage can be derived from raw
  state if deliberately retained. Historical checks, timestamps, percentages, queue position, and
  failure location are unsupported.
- **AGREE / ALREADY EXISTS — Two-pane threads:** Current split begins at 1280 px; below it routes
  expose one usable workspace at a time. Preserve the boundary that fixed the 1024 px compression
  defect.
- **AGREE / ALREADY EXISTS — Responsive/mobile and reduced motion:** Existing rules are compatible
  with bounded calibration; they are mandatory acceptance paths.
- **CONCERN — Noise/grain:** Static canvas-only grain is technically possible without a dependency,
  but there is no evidenced need. Animated/full-screen noise adds paint cost and can reduce text
  clarity. Omit it unless a later decision names a measurable benefit.

### Browser support and CSS compatibility

The implementation already uses progressive enhancement: solid/opaque base backgrounds work
without `backdrop-filter`; blur/saturation is added inside `@supports`. Masked edge highlights may
render with small browser differences but do not carry meaning. The safest extension is existing
CSS tokens/classes, not new rendering libraries or runtime feature detection.

## 4. Performance considerations

- One AppShell-level atmosphere is the correct ceiling. Repeating animated layers per panel or card
  would multiply compositor and memory cost.
- Existing 45–58 rem ambient fields use `will-change: transform`, `contain: strict`, and transform-only
  motion. Keep filter/blur animation, layout animation, parallax, and pointer tracking out.
- The product already stacks backdrop filtering across selected Chat surfaces. Adding it to rows,
  messages, citations, or scrolling dense content would create more compositor surfaces and reduce
  readability.
- Static gradients and pseudo-element highlights require no dependency. A new animation library is
  unjustified.
- Any approved token calibration still needs real-browser inspection on a low-power/mobile path,
  supported backdrop, and forced fallback. Unit tests cannot measure paint/compositing behavior.
- Preserve list virtualization assumptions: current lists are paginated and do not need a new
  virtualization dependency for visual work.

## 5. Accessibility considerations

- Preserve the shared 2 px `focus-material` ring and offset. A glass edge is never a focus indicator.
- Preserve icon + text status communication and sufficient contrast on both enhanced and opaque
  fallback materials.
- Keep assistant answers, filenames, processing errors, and citation names as inert React text with
  whitespace and overflow protection. Do not introduce Markdown/HTML to obtain inline effects.
- Keep native dialog behavior for mobile navigation, upload, Retry, and Delete: accessible names,
  initial focus, Escape, pending-state protection, focus restoration, and practical touch targets.
- Ambient fields stay `aria-hidden` and non-interactive.
- Reduced motion must freeze ambient movement, remove persistent `will-change`, and avoid smooth
  Chat auto-scroll. New motion must be covered by the existing global rule.
- Hover-only citation coupling would exclude keyboard and touch users. Any future relationship
  interaction needs focus, activation, and touch behavior with the same information.
- More translucent knowledge surfaces are rejected because readable evidence and decisions take
  precedence over material spectacle.

## 6. Responsive considerations

Use the implementation's behavioral boundaries rather than inventing a new matrix:

- below 640 px: calmer ambient fields and more opaque glass;
- 640 px: common spacing/form refinements;
- 768 px: intermediate list/layout changes;
- 1024 px: desktop Sidebar appears and the mobile navigation dialog disappears;
- 1280 px: Chat becomes two-pane, Document Details becomes two-column, and Documents becomes a
  full table;
- 1360 px: Dashboard expands from two to three summary columns;
- wide desktop: existing max-width constraints remain.

Prior accepted viewport evidence includes 390 × 844, 1024 × 768, 1280 × 800, and wide 1440-class
layouts, plus route-specific forced states. Any approved change should cover below 640,
768–1023, 1024–1279, 1280–1359, and 1360+ because each range contains a current behavior boundary.

Do not force the two-pane Chat below 1280 px, turn the Documents table into horizontal overflow, or
move lifecycle decisions ahead of the document identity on narrow screens.

## 7. Existing behavior that must be preserved

- registration validation, generic/non-enumerating outcomes, and submission locking;
- login, session bootstrap, return-to-protected-route behavior, and session-expiration handling;
- authoritative logout through the existing credentialed client;
- email verification, resend, verification-required notice, and safe error states;
- HttpOnly server-side session behavior, automatic CSRF header handling, same-origin/CORS behavior,
  and private-response handling;
- document filename search, grouped status filtering, refresh, pagination, and server ordering;
- validated multipart PDF upload, selected-file/error/submitting states, one request per action, and
  the post-upload processing message;
- owner-safe generic missing/foreign/deleted document behavior;
- categorical document lifecycle, safe Failed error, manual refresh, Failed-only Retry, deletion,
  confirmation, pending locking, and asynchronous-cleanup messaging;
- server-confirmed conversation creation and IDs, URL-backed pagination, direct routes, Back/Forward,
  generic unavailable state, and authoritative refresh;
- composer validation, Enter/Shift+Enter/IME behavior, duplicate prevention, draft preservation,
  route-switch stale-response protection, and one content-only POST;
- grounded plain-text answers, bounded same-conversation context behavior, canonical insufficient
  context, source order, duplicate sources, nullable pages, safe document navigation, and source
  snapshots;
- independent loading/error/empty/refresh states and existing Retry affordances;
- visible focus, skip links, keyboard navigation, native dialogs, touch targets, reduced motion,
  fallback opacity, and long/HTML-looking inert text.

## 8. High-risk implementation areas

1. **`apps/web/src/styles/globals.css`:** centralized strength and broad blast radius. Shared token or
   material edits affect every frozen route, fallback, and semantic state.
2. **`AppShell.tsx`:** route-scoped environment, desktop/mobile navigation, native drawer, focus,
   and content offset are coupled. Structural restyling can break navigation and accessibility.
3. **Chat orchestration and layout:** moving state out of `ChatPage` or duplicating list/thread
   composition risks duplicate POSTs, stale response leakage, broken scrolling, and lost
   authoritative refresh.
4. **Native dialog consumers:** replacing Modal/upload/mobile-navigation behavior for appearance can
   regress Escape, focus restoration, accessible naming, and mutation locking.
5. **Documents list/details:** decorative table or pipeline rewrites can invent data, break the
   1280 px semantic switch, expose internal states, or reorder Retry/Delete decisions incorrectly.
6. **Citations:** inline rendering can weaken inert-text safety, nullable-page behavior, source order,
   accessible links, and ownership-safe navigation.
7. **Authentication shell:** it has a separate composition and security-sensitive forms. Folding it
   into Living Glass during a cosmetic task is a risky refactor without a demonstrated need.
8. **Route-specific class selectors:** current CSS identity relies on class names across page and
   shared components. Renaming/extracting them during visual calibration creates unnecessary
   cross-route regression risk.

## 9. Recommended component/design-system strategy

**ALTERNATIVE — Preserve first; calibrate only if evidence appears.**

- Keep `globals.css` as the token/material source of truth; do not introduce CSS-in-JS, a second
  theme system, runtime animation library, or duplicate surface primitives.
- Keep the five material roles and `Card` variant mapping. Extend an existing semantic token or
  material class only when a real repeated need exists.
- Use `/ui-kit` as the first isolated regression surface for any approved token/material change.
- Keep feature hooks, services, schemas, resource unions, and route orchestration untouched during
  visual work.
- Restyle existing primitives and semantic composition classes before adding a component.
- Extract only if the same stable visual+behavior pattern already repeats across multiple routes;
  do not pre-emptively extract route-specific layouts.
- Do not refactor `AppShell`, native dialogs, Chat messaging orchestration, document mutation hooks,
  or API schemas as part of visual calibration.
- Preserve no-backdrop base styles first, then enhanced `@supports` rules, then mobile overrides,
  then reduced motion. This order keeps progressive enhancement explicit.

## 10. Recommended implementation sequence

No implementation is authorized by UR-001. If a later human-approved bounded task exists, use this
order:

1. Record the observed problem, desired user outcome, exact scope, exclusions, and baseline
   screenshots/measurements.
2. Confirm the existing API fields and affected state matrix; explicitly remove unsupported mockup
   content before coding.
3. Calibrate the minimum semantic token/material selector in `globals.css`.
4. Prove enhanced backdrop, forced opaque fallback, focus, reduced motion, and semantic contrast in
   `/ui-kit`.
5. Apply the calibration to **one** representative existing surface without changing component
   structure or behavior.
6. Run focused component tests and controlled browser comparison at 390, 1024, 1280, and 1440-class
   widths, including long/HTML-looking inert text.
7. Review the evidence with Claude and the human. Stop if the result does not materially improve the
   named outcome.
8. Only after approval, roll the same established token/material change through additional existing
   surfaces one route at a time: shell/navigation, Dashboard, Documents, Details, Chat, then Auth.
9. At each route, verify populated, empty, loading, error, and route-specific lifecycle/dialog states;
   run the normal web regression before moving on.
10. Perform final product-wide accessibility, responsive, fallback, console, and network sanity QA.

This sequence intentionally does not begin by rebuilding the theme, extracting components, or
changing every route at once.

## 11. Backend/API changes required for prototype concepts

Separate backend/API product tasks would be required for:

- persisted and public document page count;
- owner-scoped chunk/fragment count;
- public embedding model or vector-dimension metadata, if a user-facing need is accepted;
- per-stage processing event timestamps or durable processing history;
- progress percentage, queue position, or failed-stage information;
- owner-scoped counts for answers backed by and active conversations using a document, including
  definitions for deleted documents/conversations and citation snapshots;
- a stable insufficient-context/answer-status discriminator and reason;
- structured answer citation spans for reliable citation-to-text interaction;
- original PDF/page navigation if citation cards are expected to open exact source material;
- an operational Dashboard ask flow if it should create a conversation and send the first message.

These changes must preserve owner scoping, generic not-found behavior, soft-deletion rules, safe
public DTOs, inert content, and current RAG grounding. None belongs inside a visual-foundation task.

## 12. Concepts that should not be implemented with fake data

Do not show:

- page count derived from citation pages;
- hardcoded chunk count, model name, or 1,536 dimensions;
- fake pipeline percentages, queue positions, elapsed estimates, stage history, or stage timestamps;
- “live” processing indicators when no polling/push behavior exists;
- answer/thread usage counts inferred from the current page's citations;
- a Dashboard input that does not execute a defined server-authoritative flow;
- a special “answer withheld” reason inferred merely from zero citations;
- a claimed exact citation-to-answer span based on visual proximity or arbitrary text matching;
- original-file/page controls without a supported endpoint;
- analytics, activity, plan, or quota widgets not present in current public contracts;
- dark-mode or theme controls when the product remains approved light-only.

## 13. Questions for Claude

1. **BLOCKER:** Which observed current-product defect or user outcome does the proposal improve, and
   what evidence separates it from aesthetic preference?
2. Which of the five accepted material roles, if any, does Claude believe must change, and why can
   the problem not be solved within the current role?
3. Can the recommended direction be expressed entirely with the existing light tokens, material
   classes, three ambient fields, solid knowledge surfaces, and current breakpoints?
4. Which one representative route/surface is the smallest useful comparison target?
5. How will the proposal preserve every real loading, error, empty, processing, failed, dialog,
   reduced-motion, fallback, long-text, tablet, and mobile state?
6. Are dark aurora, neon/cyan identity, noise, extra orbs, inline citation relationships, richer
   metrics, or the Dashboard ask input still proposed? If yes, each needs a separate rationale and
   an explicit out-of-scope or contract resolution.
7. What observable visual acceptance criteria would prove an improvement without relying on
   unsupported data or subjective “more premium” language?

## 14. Questions for human/orchestrator

1. **NEEDS HUMAN DECISION:** Is there user feedback, a production defect, portfolio objective, or
   business outcome sufficient to unfreeze any Phase 12 anchor?
2. **NEEDS HUMAN DECISION:** Should UR-001 conclude with preservation, or should a new bounded task
   be created for one light-theme token/material calibration?
3. If change is approved, which single surface is the first boundary: `/ui-kit` plus Sidebar,
   `/ui-kit` plus one Dashboard action, or another named existing component?
4. Is dark mode/dark aurora intentionally being proposed as a new product direction? If so, it needs
   a new decision record and task rather than an exception hidden inside UR-001.
5. Are any richer document/citation/dashboard concepts important enough to justify separate product
   and backend contract work, or should they be removed from design exploration?
6. What evidence threshold should stop a rollout if the bounded comparison does not improve the
   named outcome?

## 15. Overall verdict

**DISAGREE** with advancing a broad Liquid Glass redesign from the present brief. The repository
already contains the requested foundation and records it as accepted and frozen. No current defect
or user/business outcome was supplied that justifies the regression surface.

**AGREE** that the architecture can support a later, tightly bounded light-theme calibration with
no new dependency and no backend change, provided the human approves a concrete problem and Claude
defines observable acceptance criteria. The correct first boundary is `/ui-kit` plus one existing
representative surface, not a product-wide restyle.

**BLOCKER** for dark aurora/neon, expanded motion, fake rich metrics, translucent knowledge
surfaces, or new Dashboard/citation behavior under UR-001. These either violate approved design
constraints, require new product/API work, or introduce accessibility/performance risk.

The safest current product decision is **Preserve**. The safest possible next implementation, if
later authorized, is **one evidence-backed token/material calibration with full state, responsive,
fallback, reduced-motion, and accessibility QA**.

## Findings

### CX-001 — No evidence currently justifies unfreezing Phase 12

- **Severity:** Blocking
- **Area:** Scope
- **Observation:** The requested exploration includes a broader direction, but no reproducible defect,
  user feedback, or measurable outcome is provided.
- **Evidence:** `docs/roadmap.md` marks Phase 12 complete/frozen; `docs/design-manifesto.md` defines its
  change rule; `task.md` requires preservation by default.
- **Risk:** Aesthetic preference could trigger a product-wide regression surface after completed
  acceptance.
- **Recommended change:** Name the problem and evidence, or close UR-001 with Preserve.
- **Acceptance condition:** Human records a bounded outcome and explicit exception, or approves no
  implementation.
- **Disposition:** Open for human

### CX-002 — Dark/neon direction conflicts with the authorized system

- **Severity:** Blocking
- **Area:** Visual / Accessibility / Scope
- **Observation:** Dark aurora and neon/glowing motifs are not a calibration of the current light
  material system.
- **Evidence:** `task.md` lists them out of scope; the manifesto forbids neon/glowing AI motifs and
  freezes a light-only hierarchy; implementation contains many light-specific surface values.
- **Risk:** Contrast, semantic status, fallback, readability, and every accepted route would need
  revalidation.
- **Recommended change:** Remove these concepts from UR-001. Use a new approved decision/task if the
  product direction genuinely changes.
- **Acceptance condition:** Proposed UR-001 direction remains light-only, or human explicitly opens a
  separate direction decision.
- **Disposition:** Open

### CX-003 — Prototype metrics exceed public contracts

- **Severity:** Blocking
- **Area:** Data
- **Observation:** Page/chunk/model/vector/history/usage metrics and semantic withheld state are not
  available in current public DTOs.
- **Evidence:** Frontend runtime schemas and backend public selects expose only the fields documented
  in the matrix above; integration tests intentionally exclude internal metadata.
- **Risk:** UI would invent facts, leak internals, or silently couple to implementation constants.
- **Recommended change:** Remove unsupported metrics from visual scope or create separate approved
  backend contract tasks.
- **Acceptance condition:** Every displayed value maps to a named public field or an explicitly
  documented safe derivation.
- **Disposition:** Open

### CX-004 — Existing responsive boundaries are behavioral contracts

- **Severity:** Important
- **Area:** Responsive / Engineering
- **Observation:** 1024, 1280, and 1360 px boundaries control navigation and workspace behavior, not
  only appearance.
- **Evidence:** `AppShell`, `ConversationsWorkspace`, Documents/Details compositions, and Dashboard
  CSS implement these switches; prior acceptance records the resolved 1024 Chat defect.
- **Risk:** A mockup-first layout rewrite could restore compression, overflow, or inaccessible
  navigation.
- **Recommended change:** Preserve breakpoints and route-driven list/thread behavior unless a separate
  responsive defect is proved.
- **Acceptance condition:** No overflow or lost action/state across all current boundary ranges.
- **Disposition:** Open

### CX-005 — Current progressive enhancement must remain intact

- **Severity:** Important
- **Area:** Accessibility / Engineering
- **Observation:** Glass appearance currently degrades to readable opaque surfaces and freezes under
  reduced motion.
- **Evidence:** Base material backgrounds, guarded `@supports` backdrop rules, mobile opacity, global
  reduced motion, and Chat's reduced-motion scroll behavior.
- **Risk:** New effects could make readability/browser support depend on blur or animation.
- **Recommended change:** Keep base -> enhanced backdrop -> mobile -> reduced-motion ordering and
  verify every approved change in all four paths.
- **Acceptance condition:** Content hierarchy and controls remain readable/usable without backdrop
  filtering and with reduced motion.
- **Disposition:** Open

### CX-006 — Existing behavior and state ownership should not be refactored for polish

- **Severity:** Important
- **Area:** Engineering / UX
- **Observation:** Hooks and page orchestrators already protect duplicate requests, stale responses,
  authoritative state, mutation locking, and safe unavailable behavior.
- **Evidence:** Feature hooks/services/tests and the route/page composition listed above.
- **Risk:** Combining visual work with state refactoring could introduce hard-to-detect business and
  security regressions.
- **Recommended change:** Limit any approved implementation to existing primitives/classes and keep
  data/state orchestration untouched.
- **Acceptance condition:** Existing contracts, request counts, routes, and behavior tests remain
  unchanged and passing.
- **Disposition:** Open

### CX-007 — Inline citation interaction needs a separately designed safe boundary

- **Severity:** Important
- **Area:** UX / Accessibility / Data
- **Observation:** Current answer text is inert and sources are separate; hover linking is neither
  structured nor touch/keyboard complete.
- **Evidence:** `ConversationThread`, `ChatMessage`, `CitationSource`, and the conversation source
  schema.
- **Risk:** Arbitrary parsing could misattribute evidence or introduce unsafe rich rendering.
- **Recommended change:** Preserve source cards for UR-001. If inline interaction is important,
  design a structured contract and accessible non-hover-only interaction separately.
- **Acceptance condition:** Citation relationship is server-authoritative or deterministically
  structured, remains inert-safe, and has keyboard/touch parity.
- **Disposition:** Open

## Confirmed strengths

- The material hierarchy directly matches the product's reading and decision needs.
- Tokens, materials, route identities, and shared primitives provide a maintainable calibration seam.
- Progressive backdrop enhancement, mobile opacity, and reduced motion already cover the primary
  glass-system risks.
- Dense data and RAG evidence remain solid/readable while navigation and interaction carry identity.
- Existing resource unions and tests cover a broad real-state matrix without inventing frontend
  authority.
- Server-authoritative IDs, timestamps, messages, citations, lifecycle, and ownership boundaries are
  preserved end to end.
- Current responsive switching deliberately protects Chat, Documents, Details, and mobile navigation.
- `/ui-kit` is an appropriate first proof surface for any later approved visual calibration.

## Claude proposal early notes

The file `design-proposal.md` exists, but at inspection time it is still the shared `DRAFT`
placeholder and contains no substantive direction, evidence, recommendation, or acceptance criteria.
Therefore this first-pass feasibility review is independent and does not evaluate a Claude design
proposal. Formal proposal review belongs in the later cross-review stage.

## Assumptions and unverified items

- No live production/browser screenshots were inspected in this review.
- No current contrast measurement, GPU trace, paint profile, or supported-browser matrix was rerun.
- Recorded Phase 12 browser acceptance is treated as historical repository evidence, not as a fresh
  test result.
- No API, web, build, lint, or unit test was run because the only authorized change is this Markdown
  review. Documentation integrity and changed-file scope are verified separately.
- A future Claude proposal may reveal a smaller evidence-backed problem; that should be evaluated in
  `cross-review.md`, not silently folded into this independent first pass.

## Summary for the decision owner

The product already has a technically coherent, accepted Liquid Glass foundation. The current code
supports safe incremental light-theme calibration through centralized tokens, material classes,
shared primitives, and `/ui-kit`, but the supplied exploration contains concepts that are either
explicitly out of scope or unsupported by public data. Preserve is the only currently evidenced
choice. If the human identifies a concrete outcome, authorize a new one-surface calibration task;
do not authorize a broad redesign, dark/neon direction, new behavior, or fake prototype metrics from
UR-001.
