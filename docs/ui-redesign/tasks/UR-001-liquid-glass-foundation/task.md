# UR-001 — Liquid Glass redesign foundation assessment

> **Final status: PROMOTED / COMPLETED / SUPERSEDED BY PRODUCTION V4** -- see `README.md` in this folder. The status line and body below record this task's state as it happened and are left unmodified.

- **Status:** `READY_FOR_PARALLEL_REVIEW`
- **Owner:** Human/orchestrator
- **Created:** 2026-08-27
- **Target phase:** Pre-implementation design assessment; roadmap phase not yet approved
- **Production-code changes authorized:** No

## Problem

The team wants to explore a coordinated UI redesign workflow, but the current repository already
records the light-only Liquid Glass Workspace as an implemented, accepted, and frozen Phase 12
production anchor. There is not yet evidence of a specific defect or an approved scope that would
justify replacing it.

The first task must establish a shared, evidence-based foundation: what is already implemented,
which qualities and invariants must survive, which concrete problems (if any) merit change, and what
the smallest coherent next design task could be.

## Evidence and current state

- `docs/design-manifesto.md` defines the accepted material hierarchy, accessibility constraints,
  semantic language, workspace density, anti-patterns, and change rule.
- `docs/roadmap.md` marks Phase 12 complete and frozen and describes production acceptance across
  Chat, Dashboard, Documents, Document Details, dialogs, mobile navigation, and the UI Kit.
- `AGENTS.md` requires preserving the approved light-only Liquid Glass direction and forbids
  broadening a feature task into a product-wide redesign.
- Production code and tests remain authoritative and must be inspected by both specialists before
  making current-state claims.

## Objective

Produce a jointly reviewed design-foundation proposal that either identifies a bounded, evidenced
improvement worth advancing or recommends preserving the current system. The output must be
specific enough for the human to approve or reject a later implementation task without ambiguity.

## In scope

- Audit the implemented Liquid Glass visual system and its shared primitives/tokens.
- Map the material hierarchy and workspace-specific density across Login, Register, Dashboard,
  Documents, Document Details, Chat, dialogs, Sidebar, and UI Kit.
- Identify concrete visual, UX, accessibility, responsive, consistency, or maintainability problems
  with evidence and severity.
- Define design principles, invariants, and measurable acceptance criteria for a bounded next task.
- Compare preservation, calibration, and redesign options with explicit trade-offs.
- Recommend the smallest coherent next task and its proposed route/component scope.

## Out of scope

- Any edit to application code, tests, dependencies, assets, configuration, infrastructure, or
  production documentation outside this task folder.
- A product-wide restyle without demonstrated problems and explicit human approval.
- New product flows, backend capabilities, APIs, metadata, progress, analytics, streaming, search,
  collaboration, or other unsupported states.
- Dark mode, exaggerated transparency, decorative motion, neon/glowing AI motifs, unsafe content
  rendering, or design changes that weaken knowledge-surface readability.
- Commit, push, pull request, merge, deployment, or granting repository access.

## Constraints and invariants

- Preserve server-authoritative data, lifecycle states, actions, IDs, titles, previews, messages,
  and citations.
- Preserve the five accepted material roles unless the human explicitly approves a revised design
  decision after cross-review.
- Keep knowledge and decision surfaces near-opaque and readable; glass remains an orientation and
  interaction material.
- Maintain visible focus, keyboard use, practical touch targets, contrast, reduced-motion behavior,
  no-backdrop-filter fallbacks, responsive layouts, and inert rendering of untrusted text.
- Proposed visual acceptance criteria must be observable and must not depend on invented backend
  behavior.
- Existing production behavior and tests are not to be changed during this task.

## Parallel assignments

### Claude — Design Director

- **Write:** `design-proposal.md`
- Inspect the current product rather than designing from chat memory.
- Record the current visual hierarchy, strengths to preserve, evidenced problems, and affected states.
- Propose up to three directions: preserve, bounded calibration, or a justified broader change.
- Recommend one direction with route/component scope, state coverage, responsive intent,
  accessibility intent, and visual acceptance criteria.
- Explicitly distinguish observed defects from aesthetic preference.

### Codex — Implementation Engineer

- **Write:** `feasibility-review.md`
- Inventory the current tokens, shared primitives, route composition, responsive rules, motion and
  fallback behavior, tests, and data/API constraints relevant to the visual system.
- Identify coupling, regression risk, unsupported states, likely test/QA scope, and the smallest safe
  implementation boundary for each plausible direction.
- Flag conflicts with the roadmap, design manifesto, accessibility, safe rendering, or backend
  contracts.
- Do not implement or pre-emptively refactor.

## Required states and viewports

The proposal must account for authenticated and unauthenticated shells where relevant; populated,
empty, loading, error, processing, failed, and dialog states where they already exist; keyboard
focus; reduced motion; no-backdrop-filter fallback; long or HTML-looking inert text; and current
desktop, compressed desktop/tablet, and mobile breakpoints evidenced in the production UI.

Exact viewport matrices should come from inspected production rules and prior recorded acceptance,
not be invented in this task.

## Acceptance criteria for the proposal stage

- Both specialists inspected the same current task revision and named source-of-truth evidence.
- The proposal preserves frozen Phase 12 anchors by default and justifies every proposed exception.
- Every claimed problem is observable, scoped, and separated from personal taste.
- Feasibility review maps the proposal to existing implementation boundaries without editing code.
- Cross-review resolves or exposes every blocking disagreement.
- The decision file presents preservation and change options, risks, exclusions, acceptance criteria,
  and a smallest recommended next task.
- No application code or unrelated existing documentation is modified.

## Required artifacts

- `design-proposal.md`
- `feasibility-review.md`
- `cross-review.md`
- `decision.md`
- `visual-qa.md` only after a separately approved implementation
- `technical-qa.md` only after a separately approved implementation

## Open questions for the human

- Which observed user or business outcome should a redesign improve beyond aesthetic preference?
- Should the first approved implementation, if any, be a shared-token calibration, one representative
  route, or another explicitly bounded surface?
- What production evidence or user feedback should count as sufficient reason to unfreeze a Phase 12
  anchor?
