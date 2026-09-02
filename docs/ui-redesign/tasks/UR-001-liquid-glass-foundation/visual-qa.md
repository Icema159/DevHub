# UR-001 — Visual QA

- **Author role:** Claude — Design Director
- **Status:** `READY_FOR_REVIEW`
- **Reviewed artifact and revision:** Codex Dark V4 first implementation (isolated Chat-only
  evaluation experiment authorized in `decision.md`, `APPROVED` 2026-08-29) — reviewed from two
  screenshots the human/orchestrator provided this turn, not from a live browser session
- **Review date:** 2026-08-29
- **Production-code changes made:** No

## Verdict

`CHANGES_REQUESTED`

The dark direction itself is correct and worth continuing — Codex's V4.1 is not being asked to start
over. But on the evidence provided, it currently reads as the existing light composition recolored
dark rather than the denser, more spatial, more evidence-forward direction the human wants, matching
the Claude prototype the human is now treating as the primary visual target for Chat V4 composition
and material feel. This finding set is the concrete specification for what changes between V4 and
V4.1.

## Evidence inspected

- **Screenshot A** — rendered Claude HTML prototype (`knowledgehub.html`), Threads screen, desktop
  width. Same render already inspected for `design-proposal.md`; re-inspected here specifically
  against Screenshot B.
- **Screenshot B** — current Codex Dark V4 implementation, real Chat route, populated conversation
  ("Tech stackas ir tinkamos pozicijos"), desktop width.
- The human/orchestrator's **HUMAN DESIGN DECISION — DARK V4 REVISION** instructions, this turn
  (12 numbered approved-direction items, plus data/architecture invariants).
- `docs/ui-redesign/tasks/UR-001-liquid-glass-foundation/decision.md` (`APPROVED`, 2026-08-29) — the
  scope and exclusions this experiment was originally authorized under.
- `cross-review.md`'s `FINAL CLAUDE RESPONSE` — the already-agreed citation-linking architecture
  (`CR-004`) and the "glass surrounds knowledge, it does not obscure it" invariant.

**Scope note:** only one viewport (desktop, wide) is visible in either screenshot. This review
cannot confirm or deny 1280/1024/390-width behavior, reduced-motion behavior, or the no-backdrop-
filter fallback from this evidence — see **Assumptions and unverified items**.

**Scope-change note:** `decision.md`'s original exclusion list names "citation marker-to-source
linking" as out of scope for this experiment. The human's message this turn explicitly supersedes
that: *"citation ↔ source interaction is now explicitly APPROVED... This feature is no longer
excluded from the V4 iteration."* This review treats it as approved per that instruction, but the
orchestrator should update `decision.md`'s own record to match — that file is outside this review's
authorship.

## Findings

### VQA-01 — Composition reads as two unrelated panels, not one workspace

- **Severity:** Blocking
- **Area:** Visual
- **Observation:** In Screenshot A, the Sidebar and the Threads workspace (thread list + conversation
  pane) each sit as distinct floating glass objects with visible dark canvas around and between them,
  but the thread list and conversation pane are fused into *one* rounded glass container with an
  internal divider — reading as a single coherent product surface. In Screenshot B, the conversation
  list and the chat panel are two separate bordered rectangles with a visible gap of bare dark
  background between them, and the Sidebar is a third, disconnected block running flush to the
  screen edges. The result reads as three independent admin-panel widgets placed on a page rather
  than one workspace.
- **Evidence:** Screenshot A vs Screenshot B, direct visual comparison of the same conversation-list
  + chat-pane relationship.
- **Risk:** This is the specific complaint the human led with — *"too much like the existing
  application with a dark theme applied"* — and it is a layout/composition issue, not a color issue,
  so no palette change alone will fix it.
- **Recommended change:** Merge the conversation rail and the chat pane into one glass container with
  an internal `border-right` divider (matching Screenshot A's `chatgrid` treatment), inset with visible
  canvas margin on all sides rather than flush to the viewport edge. The Sidebar becomes a second,
  separate floating glass object with its own margin from the canvas edge and from the workspace
  container — not flush left/top/bottom.
- **Acceptance condition:** at 1440px, the conversation rail and chat pane share one rounded-corner
  boundary and one shadow/elevation; the Sidebar has visible canvas (not white/edge-to-edge) space
  around it on at least three sides.
- **Disposition:** Open

### VQA-02 — Glass material reads flat, not physically layered

- **Severity:** Important
- **Area:** Visual
- **Observation:** Screenshot A's panels show a brighter top border edge, a soft outer shadow, and a
  visible translucency gradient that suggests a physical object catching light from above. Screenshot
  B's panels read as flat dark rectangles with a thin uniform border — closer to a "dark mode" swap of
  the existing solid-card styling than a distinct glass material.
- **Evidence:** Direct comparison of panel edges and shadows in both screenshots.
- **Risk:** Without this, "Liquid Glass" is a name, not a felt material quality — this is central to
  the product identity the human is asking for.
- **Recommended change:** Increase edge definition using an asymmetric top-lit border (brighter
  top/top-left edge, dimmer elsewhere — not a uniform-width border), a visible outer drop shadow per
  panel, and a subtle inset highlight consistent with the already-existing light-mode elevation token
  pattern (`inset 0 1px 0 rgba(255,255,255,…)` in `globals.css`) — extend that same *technique* into
  the dark token set rather than inventing a new one. Do not add blur beyond current ceilings to
  reading-critical surfaces (see VQA-08).
- **Acceptance condition:** panel edges are visually distinguishable from the current light-mode flat-
  border style in a side-by-side still frame, without relying on hue alone to signal "different
  material."
- **Disposition:** Open

### VQA-03 — Background too dark; aurora underpowered

- **Severity:** Important
- **Area:** Visual / Accessibility (real-world readability)
- **Observation:** Screenshot A's aurora is clearly visible — blue, cyan, and violet/pink color fields
  are legible as distinct light sources at the canvas corners and materially lighten the overall
  register. Screenshot B's background reads closer to uniform near-black with only a faint, diffuse
  glow; the aurora is present but not a felt part of the interface the way it is in A.
- **Evidence:** Direct comparison of background luminance and color-field visibility.
- **Risk:** The human specifically raised a real-use concern (bright-room readability/reflection on a
  near-black surface), not just a preference — this is a legitimate usability point, not only taste.
- **Recommended change:** Raise the base canvas luminance and the aurora field opacity/size toward
  Screenshot A's register; keep the same three-field, transform-only, `aria-hidden` mechanism already
  in place (no new fields, no new motion) — this is a value/intensity change to the existing tokens,
  not a new system.
- **Acceptance condition:** all three aurora hues (blue, cyan/deep-blue, restrained violet/pink) are
  independently identifiable in a static screenshot at 1440px, and background luminance is measurably
  higher than the current V4 capture while the answer surface (VQA-08) still passes contrast.
- **Disposition:** Open

### VQA-04 — Excess dead space; layout feels stretched

- **Severity:** Blocking
- **Area:** Visual
- **Observation:** Screenshot B has substantially more unused negative space around and between the
  conversation list and chat panel than Screenshot A's denser, more intentional composition. This
  compounds VQA-01 — the extra space is part of why the two panels read as unrelated.
- **Evidence:** Direct visual comparison of margin/gap proportions.
- **Risk:** Reads as an unfinished or generic dashboard rather than a considered product surface.
- **Recommended change:** Reduce outer margins and inter-panel gaps to match Screenshot A's proportions
  once VQA-01's single-container merge is applied; let the merged workspace container claim more of
  the available width rather than centering a narrower block in a wide viewport.
- **Acceptance condition:** at 1440px, the combined workspace + Sidebar composition occupies
  proportionally as much of the viewport as Screenshot A's does, with no large uninterrupted empty
  canvas regions inside the main content area.
- **Disposition:** Open

### VQA-05 — Sidebar reads as generic admin nav

- **Severity:** Important
- **Area:** Visual
- **Observation:** Screenshot A's sidebar is compact, tightly grouped (logo mark + wordmark + subtitle
  as one unit, nav items with minimal vertical rhythm, a clearly delineated account row at the
  bottom), and reads as one floating glass object. Screenshot B's sidebar has more vertical padding
  between nav items, runs the full viewport height edge-to-edge, and its account area is more spread
  out — closer to a generic admin-panel sidebar than a product identity element.
- **Evidence:** Direct visual comparison of both sidebars.
- **Risk:** The Sidebar is the single most persistent, always-visible element in the product — its
  generic-admin feel disproportionately affects overall impression.
- **Recommended change:** Match Screenshot A's compactness and grouping: tighter nav item spacing,
  the sidebar as an inset floating glass card (not edge-to-edge), a clearer active-nav treatment (a
  filled glass pill, not just a text color change), and a more tightly integrated account row.
- **Acceptance condition:** sidebar width, item spacing, and margin-from-canvas-edge are visibly closer
  to Screenshot A than to the current V4 capture; active nav state is identifiable at a glance.
- **Disposition:** Open

### VQA-06 — Typography hierarchy too flat

- **Severity:** Suggestion
- **Area:** Visual
- **Observation:** Both screenshots use a similar sans-serif family and broadly similar sizes, but
  Screenshot A's page title, conversation title, and metadata read with clearer size/weight contrast
  from each other and from body text than Screenshot B's, where the hierarchy is harder to parse at a
  glance.
- **Evidence:** Direct visual comparison of heading, title, and metadata treatment.
- **Recommended change:** Strengthen the contrast steps between page title, conversation/thread title,
  metadata (timestamps, counts), body text, and secondary/muted text — reusing the existing type-scale
  tokens (`display`/`heading-1`/`heading-2`/`small`/`caption` already defined in `globals.css`) rather
  than introducing new sizes; the change here is which existing steps get used where, and how strongly
  muted text is dimmed against the darker canvas.
- **Acceptance condition:** in a single glance at 1440px, page title, item title, and metadata are each
  identifiable as a distinct hierarchy level without reading the words.
- **Disposition:** Open

### VQA-07 — Thread rail and chat workspace should feel like one container

- **Severity:** Blocking
- **Area:** Visual
- **Observation:** Restates VQA-01 specifically for the internal thread-rail/chat-pane relationship
  (as distinct from the Sidebar/workspace relationship): Screenshot A uses one glass container with an
  internal divider; Screenshot B uses two independently bordered panels.
- **Evidence:** Same as VQA-01.
- **Recommended change:** Same as VQA-01's first recommendation — this is one implementation change
  that resolves both findings.
- **Acceptance condition:** Same as VQA-01.
- **Disposition:** Open — tracked separately only because the human's brief separated these as
  distinct approved-direction items; implementation-wise, resolve together with VQA-01.

### VQA-08 — Assistant answer surface too dark and heavy

- **Severity:** Blocking
- **Area:** Visual / UX (this is also a governance invariant, not only a preference — see below)
- **Observation:** Screenshot B's assistant answer sits inside a large, strongly bordered, quite dark
  card that reads as visually heavier than its surroundings. Screenshot A's answer content sits more
  directly within the message glass area with a lighter, more integrated feel, while still remaining
  clearly more opaque/solid than the navigation and composer glass around it.
- **Evidence:** Direct visual comparison of the assistant message treatment in both screenshots; the
  existing invariant from `cross-review.md`'s `FINAL CLAUDE RESPONSE`: *"Glass surrounds knowledge.
  Glass does not obscure knowledge."*
- **Risk:** Two failure directions are both live here and must be balanced, not traded off against each
  other: too heavy/dark (current V4, hard to read, feels like a boxed component) versus too
  translucent (the original prototype's own mistake, flagged in `design-proposal.md`, where the
  aurora shows through the answer body and reduces contrast predictability). The correct target is
  between these, not a swing to the opposite extreme.
- **Recommended change:** Lighten the answer surface's base value (a lighter near-opaque dark, not
  pure near-black) and soften/thin its border so it reads as "the calmest, most solid surface in the
  workspace" rather than "a bordered box." It should remain clearly less translucent than the
  Sidebar/composer glass — this is a value and border-weight adjustment, not a transparency increase.
- **Acceptance condition:** the answer surface has measurably higher contrast against its own
  background text than the current V4 capture, remains visibly more opaque than the composer/Sidebar
  glass, and the aurora does not show through it.
- **Disposition:** Open

### VQA-09 — Source receipts too heavy; citation↔source interaction required (MUST HAVE)

- **Severity:** Blocking
- **Area:** UX / Accessibility / Visual
- **Observation:** Screenshot B presents each source as its own individually bordered, icon-chipped
  mini-card nested inside the answer card — a card-inside-card treatment. Screenshot A presents
  sources as lightweight, flush rows (monospace cyan `[S#]`, filename, page) with no per-row border,
  separated only by spacing/hover state, reading as part of the same surface rather than a separate
  nested component. Additionally, Screenshot B's answer text does not show inline citation markers
  styled or behaving as interactive elements — this is a functional gap now explicitly in scope per
  the human's instruction this turn, not only a visual one.
- **Evidence:** Direct visual comparison of source presentation in both screenshots; the human's
  explicit "MUST HAVE" designation and the already-agreed safe implementation architecture recorded in
  `cross-review.md`'s `CR-004` (message-local, closed-vocabulary tokenizer; only labels present in
  that message's `sources` become interactive; `React` controlled elements, not `innerHTML` or a
  Markdown/HTML renderer; keyboard and touch parity; unknown markers stay inert text).
- **Risk:** Skipping the interaction (shipping only the lighter visual treatment) would under-deliver
  against what the human approved this turn; skipping the safety constraints in `CR-004` to move
  faster would reopen a settled, already-negotiated safety finding — neither trade-off is acceptable.
- **Recommended change:** (1) Restyle source rows to the lightweight receipt treatment described above.
  (2) Implement the `CR-004` architecture as-specified: hover/focus on an inline `[S#]` highlights its
  matching receipt and vice versa; activating a marker scrolls/focuses the corresponding receipt;
  keyboard and touch parity; message-local state only; unknown/malformed markers remain plain text.
- **Acceptance condition:** visually, source rows are flush/lightweight rather than boxed; functionally,
  every acceptance condition already listed under `CR-004` in `cross-review.md` holds (zero/one/many
  sources, repeated markers, malformed labels, nullable page, keyboard focus, reduced-motion-safe
  scrolling, unchanged card navigation to Document Details).
- **Disposition:** Open

### VQA-10 — Cyan evidence identity not yet present

- **Severity:** Important
- **Area:** Visual
- **Observation:** Screenshot A uses cyan consistently and only for evidence/citation elements
  (inline `[S#]` chips, source row labels, the bullet markers inside answers) — a deliberate, narrow
  second accent color distinct from the blue used for primary actions and the user's own messages.
  Screenshot B does not show this second accent; everything blue-toned reads as one undifferentiated
  color family.
- **Evidence:** Direct visual comparison; the human's explicit item 10 ("Cyan should visually connect:
  inline citations, source receipts, source-related iconography, selected/evidence states where
  appropriate... It should complement the main blue system, not turn the interface into
  neon/cyberpunk UI").
- **Recommended change:** Introduce cyan narrowly and only for evidence-related elements (citation
  markers, source receipt labels/icons), leaving primary actions, links, and the user message bubble
  on the existing blue. This is additive to the palette, not a hue replacement.
- **Acceptance condition:** cyan appears only on citation/source elements in a full-screen capture; no
  other UI element (buttons, nav, focus rings) uses it; contrast against the answer surface (VQA-08)
  and the receipt background meets the same bar already used for the current status-color tokens.
- **Disposition:** Open

### VQA-11 — Composer too heavy

- **Severity:** Important
- **Area:** Visual
- **Observation:** Screenshot B's composer is a large rectangular input with a labeled button.
  Screenshot A's composer is a thin glass pill with a small circular gradient send icon-button.
- **Evidence:** Direct visual comparison.
- **Recommended change:** Reduce the composer's height/footprint, round it into a pill matching the
  Sidebar/panel glass language, and replace the labeled rectangular send control with a small circular
  icon button — while keeping the existing Enter/Shift+Enter behavior, validation, and submission
  logic entirely unchanged (visual-only change).
- **Acceptance condition:** composer footprint is visibly reduced from the current V4 capture; send
  control is a circular icon button; no behavior, validation, or keyboard-shortcut change.
- **Disposition:** Open

### VQA-12 — Micro-polish: generic "boxed component" feeling

- **Severity:** Suggestion
- **Area:** Visual
- **Observation:** Beyond the specific findings above, Screenshot B's overall surface language
  (border weight, corner radius, shadow strength, spacing rhythm) reads closer to default component-
  library styling than Screenshot A's more considered, restrained treatment.
- **Evidence:** Direct visual comparison across all panels.
- **Recommended change:** Once VQA-01–VQA-11 are addressed, pass over borders (softer/thinner),
  corner radii (match the existing `--radius-*` scale rather than introducing new values), shadow
  strength (restrained, not heavy fog — consistent with the manifesto's existing "depth comes from
  material hierarchy, not shadow fog" principle), and spacing rhythm for consistency.
- **Acceptance condition:** no new radius, shadow, or spacing token is introduced beyond the existing
  scale extended into dark values; this is a consistency pass, not a new design pass.
- **Disposition:** Open — sequence last, after the structural findings above are resolved, since
  several of them will change what needs polishing.

## Confirmed strengths (do not regress in V4.1)

- The dark canvas direction itself, and the decision to reuse the existing three-field, transform-
  only ambient mechanism (`AmbientLightLayer`) rather than inventing new motion, are both correct and
  should carry forward unchanged in mechanism — only the value/intensity changes (VQA-03).
- The primary blue accent for user messages and primary actions is already close to Screenshot A's
  register and does not need to change.
- Citation labels (`[S1]`, `[S2]`, `[S3]`) are already present in the rendered answer text — the
  remaining work is styling and interactivity (VQA-09), not sourcing the labels themselves.
- The "Sources used" concept and its data (label, filename, page) are already correct in substance;
  only the presentation weight needs to change (VQA-09).
- Route-scoped isolation (this exists only as the approved Chat-only experiment, not a product-wide
  change) is exactly right and should not expand beyond `decision.md`'s approved boundary in this
  pass.

## Assumptions and unverified items

- This review's own findings are based only on the two static desktop-width screenshots the human
  provided this turn. On its own, that evidence cannot confirm 1280/1024/390px behavior, reduced-
  motion behavior, or the no-backdrop-filter fallback. Separately, `technical-qa.md`
  (`UR-001A`, `Codex`, `APPROVED_FOR_EVALUATION`) records that this exact matrix — 1440/1280/1024/390,
  empty/loading/error/insufficient-context, reduced motion, and no-backdrop-filter — was already run
  against the current V4 implementation and passed. That verification does not need to be repeated for
  V4.1; it needs to be **re-run once the VQA findings above are applied**, since several of them change
  surface values the matrix depends on (answer-surface contrast, aurora intensity, receipt styling).
- No contrast measurement was run against the actual rendered colors; VQA-03 and VQA-08's acceptance
  conditions describe relative direction ("higher than current," "aurora does not show through") that
  Codex should verify numerically once the values are chosen, not treat as satisfied by eye alone.
- The citation-linking scope change noted above (now approved per this turn's instruction, previously
  excluded in `decision.md`) should be confirmed in the orchestrator's own record; this review treats
  it as approved based on the direct human instruction it was given this turn.

## Summary for the decision owner

Codex's first Dark V4 pass is a sound technical foundation (correct route isolation, correct reuse of
the existing ambient/material mechanism, correct data) but is not yet visually where the human wants
it: it currently reads as a recolor of the existing light layout rather than the denser, more
spatial, more unified composition shown in the Claude prototype. Twelve findings above give Codex a
concrete, ordered specification for V4.1, four of them (VQA-01/04/07 composition and dead space,
VQA-08/09 answer readability and the now-approved citation interaction) load-bearing enough to mark
`Blocking`, the rest `Important` or `Suggestion` polish. Recommended sequencing: resolve the
composition merge (VQA-01/04/07) first since several other findings are easier to judge once the
layout itself is fixed, then the material/aurora/answer-surface value changes (VQA-02/03/08),
then Sidebar and typography (VQA-05/06), then source receipts and cyan identity together since they
are visually linked (VQA-09/10), then composer (VQA-11), then the micro-polish pass last (VQA-12). `technical-qa.md` already shows the
full responsive/reduced-motion/fallback matrix passing for the current V4 build; that matrix should be
re-run once V4.1 lands, since several findings above change the values it depends on, but it does not
need to be designed from scratch.
