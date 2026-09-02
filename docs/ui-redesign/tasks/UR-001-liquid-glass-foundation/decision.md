# UR-001 — Human decision record

- **Status:** `APPROVED`
- **Decision owner:** Human product owner
- **Decision date:** 2026-08-29
- **Implementation authorized:** Yes — isolated Chat-only Dark V4 evaluation experiment
- **Commit/push/merge authorized:** No

## Inputs reviewed

- `design-proposal.md` — `READY_FOR_REVIEW`, reviewed 2026-08-29
- `feasibility-review.md` — `READY_FOR_REVIEW`, reviewed 2026-08-29
- `cross-review.md` — `PROPOSED`, including Claude's `READY_FOR_REVIEW` final response

## Options

- Preserve the current production Chat experience.
- Evaluate one reversible, development-only Chat Dark V4 surface using the existing real Chat data
  and behavior.
- Keep citation linking and Dashboard attention hierarchy as separate, unapproved tasks so visual
  identity can be evaluated independently.
- Do not treat a successful Chat experiment as approval for a product-wide Dark V4 rollout.

## Unresolved disagreements and risks

- Chat is sufficient to decide whether Dark V4 should be explored further, but not sufficient by
  itself to approve a product-wide rollout. A denser surface would require a separate later decision.
- Cyan may be evaluated as a restrained source/evidence accent in the experiment, but must not
  replace labels, focus, text contrast, or semantic meaning.
- Dark V4 accessibility, performance, reduced-motion, and no-backdrop-filter behavior must be judged
  from the isolated implementation evidence rather than assumed from the prototype.

## Decision

`APPROVE`

Build an isolated Chat-only Dark V4 evaluation experiment to answer whether the dark direction
creates a materially stronger first impression and product identity than the current production
Chat experience. This is an evaluation surface, not a shipped redesign or replacement.

## Approved scope and exclusions

- **In scope:**
  - a development-only experiment route or equivalently isolated surface;
  - the minimum surrounding AppShell/Sidebar treatment necessary to judge Chat;
  - dark canvas and restrained aurora;
  - route-scoped Navigation, Workspace, Interaction/Composer, selected, focus, hover, and active
    material treatments;
  - current user messages, near-opaque assistant answers, current source cards, current composer,
    and existing empty/loading/error/insufficient-context states;
  - responsive, reduced-motion, and no-backdrop-filter verification;
  - small behavior-preserving composition or routing seams needed to reuse the real Chat pipeline;
  - implementation and QA documentation in this task folder.
- **Out of scope:**
  - changing or replacing the default `/chat` experience;
  - product-wide Dark V4, a theme toggle, or production navigation to the experiment;
  - Dashboard, Documents, Document Details, or Auth redesign;
  - citation marker-to-source linking;
  - backend, API, RAG, Worker, Prisma, database, auth/session, CSRF, or dependency changes;
  - fake metrics, fake conversations, fake citations, fake timestamps, or unsupported product state;
  - commit, push, merge, deployment, or production rollout.

## Authorized next action

Codex may implement and locally verify only the isolated Chat Dark V4 experiment described above.
This approval does not authorize commit, push, pull request, merge, deployment, production rollout,
or work on another screen.

## Acceptance conditions for any later implementation

- The experiment is reachable only through an explicit development-only route and is absent from
  normal production navigation and production route registration.
- Existing `/chat` and `/chat/:conversationId` routes retain their current appearance, behavior, and
  tests.
- The experiment reuses existing owner-scoped conversations, message history, submission, source
  cards, loading/error/empty states, and backend-authoritative refresh behavior.
- Assistant answers and source evidence remain near-opaque and readable; glass surrounds knowledge.
- No unsupported data or special inferred insufficient-context state is introduced.
- Exactly the current three ambient fields are reused; no animated filters, pointer tracking, extra
  orbs, or animation dependency is added.
- Keyboard focus, touch targets, reduced motion, and readable opaque fallback remain intact.
- Controlled comparison covers 1440, 1280, 1024, and 390 px using real route state, with reduced
  motion and no-backdrop-filter paths.
- Existing frontend tests, typecheck, lint, build, and `git diff --check` pass.

---

## Human Decision Amendment — Dark V4.1

- **Amendment status:** `APPROVED FOR V4.1 EVALUATION IMPLEMENTATION`
- **Decision owner:** Human product owner
- **Amendment date:** 2026-08-29
- **Implementation authorized:** Yes — isolated Chat-only Dark V4.1 revision
- **Commit/push/merge/deploy authorized:** No

The original Dark V4 experiment proved technically viable but is visually too conservative. It
reads too much like the existing application with dark colors applied. Dark V4.1 must move
substantially closer to the Claude HTML prototype and Screenshot A in composition, material feel,
spatial depth, aurora visibility, typography hierarchy, source/evidence identity, Composer
treatment, and micro-polish.

The real React application remains the functional and data source of truth. The Claude HTML
prototype and Screenshot A are the primary visual references for Chat V4.1. This remains an
evaluation experiment and is not authorization for a product-wide Dark V4 rollout.

### Approved V4.1 direction

1. Build a centered floating composition: a separate inset glass Sidebar and one unified
   conversation-rail + Chat workspace with an internal divider.
2. Strengthen perceived Liquid Glass depth through appropriate translucency, asymmetric edge
   highlights, layered material separation, restrained outer shadow, and subtle inset highlight.
3. Raise the dark canvas luminance and make the existing three aurora fields visibly contribute.
   Do not add ambient fields or decorative motion.
4. Reduce dead space and move materially closer to the Claude prototype's intentional density.
5. Make the Sidebar more compact, inset, product-specific, and clearly selected, with tighter
   account integration.
6. Strengthen title, item-title, metadata, body, and muted-text hierarchy using the existing type
   system where possible.
7. Make the conversation rail and Chat pane visibly belong to one workspace container.
8. Lighten the assistant answer to a near-opaque dark knowledge surface. The aurora must not
   interfere with long-form reading: glass surrounds knowledge; glass does not obscure knowledge.
9. Replace heavy nested source cards with lightweight receipt rows using cyan `[S#]`, filename, and
   nullable page information.
10. Use cyan narrowly as evidence/source identity. Primary actions and user messages stay blue;
    the result must not become neon or cyberpunk.
11. Make the Composer thinner, lighter, glass-like, integrated, and less rectangular, with a small
    circular send icon while preserving all behavior and validation.
12. After structural work, refine borders, radii, selection, spacing, shadows, and surface hierarchy
    without introducing generic boxed-component styling.

### Citation interaction scope amendment

The original decision's exclusion of citation marker-to-source linking is explicitly
**SUPERSEDED FOR THE ISOLATED DARK V4.1 EXPERIMENT ONLY**. It is not silently deleted and does not
authorize a product-wide citation-rendering change.

Dark V4.1 must implement the reconciled `CR-004` architecture:

- only exact message-local `[S#]` labels present in that message's sources become interactive;
- unknown or malformed markers remain inert React text;
- inline marker and matching receipt share hover/focus highlight state;
- marker activation scrolls to and focuses the matching source target;
- keyboard, pointer, touch, and reduced-motion-safe behavior are required;
- state and lookup remain message-local, including repeated labels;
- no `innerHTML`, `dangerouslySetInnerHTML`, Markdown/HTML renderer, arbitrary rich-text parsing,
  cross-message lookup, or global thread query is permitted.

### Preserved boundaries and future checkpoint

- Preserve existing backend, API, Worker, Prisma, database, RAG, authentication, session, CSRF,
  ownership, network/state, responsive, and real-data behavior.
- Do not introduce fake conversations, sources, metrics, telemetry, model metadata, fragment/vector
  counts, processing history, or unsupported state.
- Dashboard, Documents, Document Details, Auth, rich technical metadata, and production deployment
  remain out of scope.
- A successful Chat V4.1 result may justify another bounded experiment. It does not authorize a
  product-wide rollout; at least one denser surface, likely Documents or Dashboard, must be evaluated
  through a future human decision before that question is reopened.

### Authorized next action

Codex may implement and locally verify VQA-01 through VQA-12 for the isolated Chat Dark V4.1 route,
including the superseding citation interaction above. Stop after V4.1 and its QA. No work on other
routes or product-wide Dark V4 is authorized.
