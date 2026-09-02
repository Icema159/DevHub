# UR-001 — Design proposal

- **Author role:** Claude — Design Director
- **Status:** `READY_FOR_REVIEW`
- **Task revision reviewed:** `task.md` dated 2026-08-27 (reviewed 2026-08-29)
- **Production-code changes made:** No

## Note on a source conflict (recorded per `protocol.md`, "stop at the earliest safe point")

The orchestration prompt for this session asked Claude to evaluate evolving the product toward the
dark, aurora-background "Liquid Glass" direction shown in an attached HTML prototype
(`knowledgehub.html`), and listed "dark aurora background" among the qualities to consider
preserving.

Two higher-priority sources on record conflict with adopting that direction outright:

- `docs/ui-redesign/tasks/UR-001-liquid-glass-foundation/task.md` — Out of scope: *"Dark mode,
  exaggerated transparency, decorative motion, neon/glowing AI motifs, unsafe content rendering, or
  design changes that weaken knowledge-surface readability."*
- `docs/design-manifesto.md` — Change rule: *"Chat, Dashboard, Documents, Document Details, the
  global Sidebar, the shared material system, and the semantic status language are frozen Phase 12
  production anchors... must not casually introduce a new visual direction."*

Per the collaboration protocol's source-of-truth order, a chat prompt is the lowest-priority input
and does not override the task definition or the manifesto. Per the same protocol: *"If two sources
conflict, stop at the earliest safe point, record the conflict, and ask the human to resolve it. Do
not make production behavior match a lower-priority document automatically."*

This proposal resolves the conflict the way `task.md` itself already anticipates: the prototype is
now fully inspected (code read in full, rendered with a headless browser at desktop and mobile
viewports across all four of its screens) and evaluated on its merits as **Option C — broader
change, only if justified**. It is not adopted by default, and this proposal does not recommend
shipping dark mode. Whether to pursue Option C is recorded below as a decision for the human, because
it requires explicitly unfreezing named Phase 12 anchors — something outside this proposal's
authority.

## Evidence inspected

**Documentation (read in full):**
`docs/ui-redesign/README.md`, `protocol.md`, `roles.md`, `decision-workflow.md`,
`tasks/UR-001-liquid-glass-foundation/{README.md,task.md}`, `docs/design-manifesto.md`,
`docs/product-scope.md`, `docs/roadmap.md` (Phase 0–9, focused on Phase 12 delivery notes).

**Production code (read directly):**
- `apps/web/src/styles/globals.css` (853 lines) — full token set: color, type scale, radius,
  shadow/elevation, `@supports (backdrop-filter)` fallback block (lines 714–770), responsive
  breakpoints (630, 640, 792), `prefers-reduced-motion` block (line 839).
- `apps/web/src/components/layout/AmbientLightLayer.tsx` — the "Living Glass" background: three
  `<span>` light fields (`--blue`, `--violet`, `--lower`).
- `apps/web/src/components/composed/ChatMessage.tsx` and `CitationSource.tsx` — full citation
  rendering path, inline-marker handling, and card markup.
- Directory structure of `apps/web/src` (`features/{dashboard,documents,conversations,auth}`,
  `components/{ui,composed,layout}`).

**Production screenshots viewed** (all from `output/`, the team's own recorded Phase 12 acceptance
evidence — no live browser session against the running app was run):
`phase12.1/ui-kit-materials-1440x900.png`, `phase12.2d/o-final-1440x900.png` (Chat, desktop),
`phase12.2d/j-final-390x844.png` (Chat, mobile), `phase12.2d/n-reference-implementation-comparison.png`,
`phase12.3/implementation-dashboard-v3-1440x900.png` (Dashboard), `phase12.4/documents-v3-1440x900.png`
(Documents), `phase12.5/03-details-ready-after.png` and `04-composer-rim-after.png` (Document Details).

**Prototype (`knowledgehub.html`, provided mid-task — now fully inspected):**
Read the complete source (804 lines: markup, CSS, and behavior script) and independently rendered it
with a headless browser at 1440×900 (Overview, Documents, Document record, Threads) and 390×844
(Overview), screenshotting each. This is genuine evidence, not inference — every claim about the
prototype below cites a line number or a rendered screenshot.

**Not inspected:** a live/running instance of the production application; the automated test suite;
`apps/web/src/features/**` component internals beyond the citation path noted above.

## Current-system assessment

### Material hierarchy — matches the manifesto, evidenced in code and screenshots

`globals.css` implements exactly the five roles the manifesto names: `--color-glass-navigation`
(rgba 255/255/255 0.76), `--color-glass-workspace` (0.84), `--color-glass-interaction` (0.9),
`--color-surface` / `--color-surface-elevated` (solid white), and a light `--color-background`
(`#f6f7fb`) atmospheric canvas. `AmbientLightLayer.tsx` renders the environmental motion as three
independent transform-only fields, matching the manifesto's "no mouse-follow, no particle system"
rule. Elevation tokens (`--shadow-elevation-0/1/2`) each include an `inset 0 1px 0 rgba(255,255,255,…)`
highlight line — the "local, asymmetric, environment-reactive edge" the manifesto specifies, already
functioning as a restrained liquid-glass edge language.

**This is the most important finding of the audit:** the product does not need to adopt a prototype
to get a "Liquid Glass" identity, a moving ambient background, or contained semantic accents — it
already has all three, in a light, calm register. The real gap between the current product and the
prototype is mostly a *value/tone* gap (light vs. dark, restrained vs. dramatic) plus one genuine
*interaction* gap (citation linking, below) — not a structural gap.

### Typography, spacing, controls — mature, evidenced via the UI Kit sheet

`globals.css` defines a single eight-step type scale (`display` 2rem down to `caption` 0.6875rem)
built on Inter, and `radius-{control,card,glass,action}` plus a full button/input/status variant set
is visible in `output/phase12.1/ui-kit-materials-1440x900.png` (Small/Primary/Large/Secondary/Ghost/
Destructive/Disabled/Saving buttons; populated, disabled, and error input/select states). No
evidenced defect in either system.

### Status language — consistent, contained, icon + text

`--color-status-{ready,processing,failed,info}-{foreground,background,border}` are all distinct,
accessible-contrast pairs, and every screenshot (Dashboard, Documents, Document Details) shows the
same three-state badge pattern with an icon. The Dashboard's "Documents requiring attention" panel
tints only its own cards pink — the rest of the workspace stays neutral, matching the manifesto's "a
failed document does not turn the whole workspace red" rule. No evidenced defect.

### Citation and source identity — the one concrete, code-evidenced gap in the real app

`ChatMessage.tsx` renders the assistant's answer body as one block, then — only after it — a separate
"Sources used" section built from `CitationSource.tsx` cards (icon chip, `[S1]`-style label, filename,
page, linking to Document Details). The inline `[S1]` / `[S2]` markers visible inside the answer text
in `phase12.2d/o-final-1440x900.png` are rendered as **inert plain text** — no code path connects an
inline marker to its matching card (no shared id, no hover/click correlation). A reader has to
manually match a bracket number in a paragraph to a card in a separate list.

The prototype happens to solve exactly this, completely (see Option C below). This is a genuine,
observable interaction gap, not aesthetic preference — it directly weakens the product's own stated
value ("Sources before generated text — the user must be able to verify an AI answer," per
`product-scope.md`).

### Dashboard hierarchy — one minor, bounded observation

`implementation-dashboard-v3-1440x900.png` gives "Recent documents," "Recent conversations," and
"Documents requiring attention" equal visual weight. With two failed documents present, the attention
panel is no more prominent than the two purely informational columns next to it. Minor, testable, not
structural.

### Everything else audited — no evidenced defect

Navigation/shell, borders/shadows/depth, responsive behavior (1440/1280/1024/390 matrix), and
accessibility mechanics (`prefers-reduced-motion` at `globals.css:839`, `@supports (backdrop-filter)`
fallback at lines 714–770, descriptive `aria-label`s in `CitationSource.tsx`, icon+text status) are
implemented and were exercised in the recorded Phase 12 acceptance runs referenced in
`docs/roadmap.md` (290–292 passing frontend tests per delivery task, plus standalone browser
acceptance matrices in `output/phase12.{3,4,5}/*acceptance*`). I did not re-run these checks; I treat
them as verified evidence rather than re-litigating them without new information.

## Evaluation by requested area

`K` = Keep · `C` = Change (bounded) · `R` = Reject for this task · `N` = New proposal ·
`O` = Open question for human/Codex

| # | Area | Tag | Note |
|---|------|-----|------|
| 1 | Visual hierarchy | K / C | Material-role hierarchy is sound; minor calibration only on Dashboard attention panel. |
| 2 | Navigation & shell | K | Floating glass rail, consistent across routes, collapses cleanly on mobile. No defect. |
| 3 | Typography | K / O | Scale is legible and restrained; whether page titles should read one step larger is a taste call for the human, not a defect. |
| 4 | Spacing & density | K | Density already follows the task per workspace, per the manifesto's own rule. |
| 5 | Color system | K / O | Indigo/blue-violet primary with contained accents already answers "blue/cyan accents." Whether to recalibrate the semantic swatch family is optional, low priority. |
| 6 | Dark aurora background | O (Option C) | Already implemented in light form (`AmbientLightLayer.tsx`). A dark version is evaluated below; adopting it needs an explicit human decision to unfreeze the manifesto. |
| 7 | Glass material | K | Five-role hierarchy with motion/blur fallbacks is sound engineering, independent of light/dark. |
| 8 | Borders, shadows, depth | K | Inset-highlight elevation tokens already express restrained liquid-glass edges. |
| 9 | Buttons & controls | K | Full, mature variant set with real disabled/saving/error states (UI Kit sheet). |
| 10 | Status treatments | K | Icon+text, contained tinting, consistent 3-state model. Strength to protect. |
| 11 | Dashboard information hierarchy | C | Give the attention panel visual priority when non-empty (bounded, see Option B). |
| 12 | Documents presentation | K | Dense solid table + one interaction-glass filter bar matches the manifesto's density rule. |
| 13 | Document Details presentation | K | Clean glass-identity / solid-decision separation; no defect found. |
| 14 | Threads/chat presentation | K / C | Structure is sound; citation linking (below) is the one real gap. |
| 15 | Citation/source visual identity | C / N | Adopt the prototype's proven inline-marker ↔ card linking *interaction pattern* now, inside the current light system (Option B). |
| 16 | Empty/loading/processing/failed states | K | Already covered by recorded Phase 12 acceptance screenshots and tests; not re-litigated here. |
| 17 | Responsive behavior | K | 1440/1280/1024/390 matrix already covered and frozen. |
| 18 | Accessibility & readability | K | Reduced-motion, backdrop-filter fallback, icon+text status, descriptive citation `aria-label`s all present in code. |
| 19 | Prototype parts worth preserving | N (Option C) | Bidirectional citation linking; pipeline timeline for processing steps; monospace metadata treatment; segmented filter control. All can be adapted without going dark. |
| 20 | Prototype parts to simplify/reject | R (Option C) | Glass/blur on the assistant answer body (long-form reading content); unverified fields (`Fragments`, `Vectors`, "backs N answers"); literal prototype copy/counts as real data. |

## Options and trade-offs

### Option A — Preserve

Make no change. The current system is internally consistent, documented, frozen, and has one
concrete interaction gap. A legitimate outcome under `task.md`'s own framing.

*Trade-off:* leaves the citation-linking gap unaddressed even though a proven, cheap-to-adapt pattern
now exists to fix it.

### Option B — Bounded calibration (recommended)

Two independently shippable changes, entirely inside the existing five-role material system and the
current light register — no new visual family, no frozen-anchor exception needed:

1. **NEW PROPOSAL — Linked inline citations, using the prototype's own interaction model.**
   `knowledgehub.html` lines 159–165 and 753–772 implement exactly this: each inline marker
   (`sup.cite`) and its matching source card (`.receipt`) share a `data-src` id; hovering either
   highlights both (`mouseover`/`mouseout` adding an `is-hot` class), and clicking a marker calls
   `scrollIntoView` on its card. This is a complete, working reference implementation of the
   *behavior* the real app is missing — only its dark visual skin should be left behind. Reimplement
   the same marker↔card linking behavior against the current `ChatMessage.tsx` / `CitationSource.tsx`
   components and their existing light-mode styling (indigo accent, not cyan, to match the current
   `--color-primary`).
   *Feasibility uncertain — mark for Codex:* the current answer body may render as one inert string
   for safe-text reasons. Confirm whether wiring per-marker interactivity fits inside the existing
   safe-rendering approach, or needs a new rendering path — the prototype has no untrusted-content
   constraint to satisfy, so its approach cannot be copied blind here.
2. **CHANGE — Dashboard attention-panel priority.** When "Documents requiring attention" is
   non-empty, give it a modest visual priority increase (e.g., a top accent tied to
   `--color-status-failed-border`, or reordering first on narrow viewports). Token-level / layout-
   order change only.

*Optional, lower priority, not required for the above:* recalibrating `--color-success/warning/danger`
away from stock Tailwind swatches toward the product's own indigo/violet family — mark for Codex
contrast re-verification before scoping as its own task.

*Trade-off:* smaller visual impact than a full redesign; does not by itself deliver the "serious AI
knowledge product" ambition the prompt described beyond the citation and hierarchy fixes.

### Option C — Broader change toward the prototype's dark/aurora direction (now evaluated, not yet actionable)

The prototype is a well-executed, restrained dark "Liquid Glass" system — not neon or decorative. It
is worth taking seriously as a possible future direction, with specific reservations.

**Worth preserving if this direction is ever approved (`N`):**
- The bidirectional citation-linking pattern above — the strongest single idea in the file, and
  reusable regardless of the dark/light decision.
- A step-by-step processing pipeline with a connecting line and checkmarks (lines 259–266, rendered
  in `proto-document.png`): Uploaded → Parsed → Chunked → Embedded → Indexed. This maps cleanly onto
  the real, already-implemented backend lifecycle (`PENDING → PROCESSING → CHUNKS_READY → EMBEDDING →
  READY`, `docs/roadmap.md` Phase 6) and would give Document Details a stronger sense of process than
  today's single "Processing status" card — *if* every displayed step and timestamp is sourced from
  real API data, not invented.
  `INFERENCE (rendered, not confirmed against the API): the prototype hardcodes per-step timestamps
  (e.g., "2:37:12 PM · 10 pages of text extracted") that were not verified to exist as real fields.`
- A segmented filter control (`.seg`, lines 215–220) as an alternative to the current pill-row filter
  — a legitimate, low-risk visual variant of an already-solid pattern.
- A small monospace "technical identity" caption (`pgvector · text-embedding-3-small · 1,536 dims ·
  cosine`, line 410) is more defensible here than it might be in a general consumer product: the
  target user is explicitly "an individual software developer" (`product-scope.md`), and the values
  shown are consistent with the product's real, documented architecture (pgvector, 1,536-dimension
  vectors, cosine similarity are confirmed in `docs/architecture.md`/the app's own RAG answers). This
  is an `OPEN QUESTION`, not a rejection: acceptable only if every value is pulled from real
  configuration, never hardcoded copy, and Codex confirms it doesn't overcommit to an
  implementation detail that may change (e.g., the embedding model name).

**Reject or fix before this could ship (`R`):**
- **Glass on the answer body.** `knowledgehub.html` lines 295–300: `.msg-a .a-body` — the assistant's
  actual long-form answer — uses `background:rgba(255,255,255,.08)` with `backdrop-filter:blur(20px)`.
  This is translucent glass on the single most reading-critical surface in the product, directly
  against the manifesto's core rule: *"Reading is sacred... Glass surrounds knowledge; it does not
  obscure knowledge"* and *"a Solid Knowledge/Information Surface [for] documents, answers,
  citations."* If Option C is ever pursued, the answer body must become a solid (near-opaque) dark
  surface, matching how the current light system already treats it — this is not a minor nit, it is
  the single clearest place the prototype conflicts with the product's own accepted principle.
- **Unverified Document Details fields.** `Fragments: 42`, `Vectors: 42 × 1,536 dims`, and "This
  document backs 4 answers across 2 threads" (lines 528–534) are prototype-invented; the current
  Document Details screen exposes no such fields. `task.md` explicitly warns not to assume prototype
  page/fragment/vector counts exist in the real application — this proposal repeats that warning
  because the prototype makes these numbers look authoritative. Any of these shown for real would
  need a confirmed API field first.
- **Literal counts and copy as content**, not layout — same caution as above, applied generally.

**Why this is not actionable yet, regardless of quality:**
- It falls inside `task.md`'s explicit out-of-scope list and would require the human to explicitly
  unfreeze Phase 12 anchors recorded in `docs/design-manifesto.md` — this proposal does not have that
  authority, and a proposal document is the wrong place to grant it to itself.
- Even a well-executed dark direction is a full material-system change (new background canvas, new
  glass alpha/blur values, a second accent color for citations, new elevation shadow colors) — that
  is Option C's scope by definition, not a "calibration."

*If the human wants to proceed,* the smallest responsible next step is: (1) record an explicit
decision to reopen the named Phase 12 anchors for a bounded surface (not the whole product at once —
Chat is the natural first candidate, since it has the clearest prototype reference), (2) open a new
task scoped to that single surface, and (3) have Codex assess contrast, performance (blur cost), and
data-availability feasibility for the pipeline-timeline and technical-identity ideas in parallel.

## Recommended direction

**Option B**, shipped now. Reimplement the prototype's citation-linking *behavior* (not its visual
skin) against the current light-mode components, and give the Dashboard attention panel modest visual
priority when non-empty.

**Record Option C as an open, human-owned decision**, not a rejection — it is a genuinely strong
direction with one clear principle conflict (glass on the answer body) and one clear data-integrity
risk (unverified metadata fields), both fixable, but it requires the human to explicitly reopen frozen
scope before any specialist should act on it further.

**Scope for Option B:** `apps/web/src/components/composed/{ChatMessage,CitationSource}.tsx` and the
relevant Dashboard summary component under `apps/web/src/features/dashboard`. No route, API, data
contract, or test outside the visual/interaction layer of these components should change.

**Exclusions for Option B:** no color-token family change, no dark mode, no new material role, no
change to lifecycle states, citation data shape, or any backend-authoritative value.

## Visual and interaction acceptance criteria

- An inline citation marker (`[S1]`, `[S2]`, …) is keyboard-focusable and visually distinct from
  surrounding body text without breaking inert/safe text rendering of the surrounding answer.
- Activating an inline marker visibly connects to its matching source card (e.g., scroll + brief
  highlight) within the same message; navigation to Document Details remains the card's own click
  behavior, unchanged.
- The connection works with `citations.length` of 0 (no crash, no dead markers), 1, and many.
- "Documents requiring attention," when it contains at least one item, is visually distinguishable
  from "Recent documents" and "Recent conversations" at a glance, at 1440×900 and 390×844.
- When "Documents requiring attention" is empty, the Dashboard layout matches the current, already
  accepted empty state (`output/phase12.3/empty-dashboard-1440x900.png`) with no new visual weight.
- No change alters existing status badge colors, the icon+text pattern, the glass/solid role of any
  existing surface, or the five material-role tokens in `globals.css`.

## Accessibility and responsive intent

- The inline citation marker must remain reachable and operable by keyboard (matching the existing
  `focus-material` pattern already used on `CitationSource`), must not depend on hover alone, and
  must keep a descriptive `aria-label`, as `CitationSource.tsx` already does for cards. The
  prototype's own `mouseover`/`mouseout`-only linking (lines 753–765) is not sufficient on its own —
  Option B must add keyboard/focus parity that the reference implementation lacks.
- Reduced-motion behavior is unaffected: any "scroll and highlight" interaction must be instant (no
  animated scroll, no pulsing highlight) whenever `prefers-reduced-motion: reduce` is active, per the
  existing block at `globals.css:839`. Note the prototype does get this right for its own motion
  (`@media (prefers-reduced-motion:reduce)`, lines 55–59, disables its orb drift and message-arrival
  animation) — worth matching, not just avoiding its mistakes.
- No `@supports (backdrop-filter)` dependency is introduced by Option B — both changes affect solid-
  surface content, which the manifesto requires to stay near-opaque and readable regardless of blur
  support.
- Dashboard reordering, if used on narrow viewports, must not change tab order in a way that
  separates the attention panel from its heading, and must be verified at 1440, 1280, 1024, and 390
  px per the existing accepted matrix.

## Assumptions and open questions

- **For the human:** please confirm whether this task should proceed under Option B as scoped above,
  whether Option A (preserve, no change) is preferred, or whether Option C should be opened as its
  own separately-scoped, explicitly-approved follow-up task (recommended first candidate surface:
  Chat only, given the prototype's strongest and most complete reference is the Threads/chat screen).
- **For the human, only if Option C is opened later:** which specific Phase 12 anchors should be
  reopened, and for which surface — this proposal does not recommend reopening all of them at once.
- **For Codex (feasibility review):** confirm whether the answer body's current safe-text rendering
  approach supports per-marker interactive segments (Option B, item 1) without introducing a new
  rich-text/markdown renderer or weakening the inert-text guarantee for hostile/HTML-looking content.
- **For Codex (feasibility review):** confirm current WCAG contrast for `--color-status-*` pairs
  before any future semantic-color-family calibration is scoped as its own task.
- **For Codex (feasibility review, only if Option C is opened):** confirm whether "Fragments,"
  "Vectors," and per-step processing timestamps shown in the prototype's Pipeline panel correspond to
  any real, exposable API field today, or would require new backend work.
- Answering `task.md`'s own open questions from this proposal's perspective: the clearest observable,
  non-aesthetic outcome a change should improve is source-answer verifiability (the citation-linking
  gap, now with a concrete reference pattern to adapt); the smallest bounded next surface is the Chat
  citation path plus the Dashboard attention panel, as scoped in Option B; and no production evidence
  currently justifies unfreezing a Phase 12 anchor for a full redesign — only a deliberate, separately
  evidenced product decision would, and Option C above is what that decision would be choosing between.
