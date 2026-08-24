# Phase 11.0 Design QA

## Reference and implementation

- Approved visual reference: `/Users/Aismantas/Downloads/Generated image 1 (2).png`
- Reference dimensions: 1536 × 1024
- Reference state: authenticated desktop Dashboard, light theme
- Implementation routes reviewed:
  - `/dashboard` at 1440 × 1000
  - `/ui-kit` at 375 × 900, 768 × 1024, 1024 × 900, and 1440 × 1000
- Browser: local headless Google Chrome against the Vite development server

Phase 11.0 intentionally does not implement the full Dashboard shown in the reference. The
comparison therefore covers the approved visual language, application shell, component hierarchy,
spacing, color, responsive behavior, and readability. Product modules and real data visible in the
reference are intentionally absent.

## Full-frame comparison

| Area               | Result                                                                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visual hierarchy   | Passed. The persistent left navigation, strong page heading, restrained supporting copy, and generous workspace spacing match the reference direction.                                                               |
| Layout geometry    | Passed. The final 272px desktop sidebar and content offset closely follow the reference proportions. The implementation uses a floating rounded glass rail as required by the Phase 11.0 Liquid Glass specification. |
| Typography         | Passed. Inter, semibold headings, compact labels, and readable body copy maintain the reference hierarchy without reducing long-form readability.                                                                    |
| Color              | Passed. Indigo primary, mint success, amber processing, coral failure, and cool neutral surfaces align with the approved palette.                                                                                    |
| Surfaces           | Passed. Glass is used for navigation and short interactive panels; solid opaque surfaces are used for document rows, chat answers, and form-heavy content.                                                           |
| Density            | Passed. Controls and cards remain spacious while the document and citation examples stay scan-friendly.                                                                                                              |
| Accessibility cues | Passed. Focus-visible states, icon-plus-text statuses, minimum control targets, semantic headings, and reduced-motion variants are present.                                                                          |

## Focused component comparison

The sidebar was compared separately because it establishes the product's navigation and brand
rhythm. The first implementation capture used a 256px sidebar and caused the brand text to wrap.
The sidebar was widened to 272px and the main-content offset was adjusted. The final capture keeps
the brand on one line and aligns more closely with the approved reference.

The Dashboard reference uses a flush left rail, while the implementation uses a subtle floating
glass rail. This is an intentional Phase 11.0 adaptation of the approved Liquid Glass requirements,
not a fidelity defect.

## Responsive and runtime checks

| Width  | Navigation         | Horizontal overflow | Runtime exception |
| ------ | ------------------ | ------------------- | ----------------- |
| 375px  | Mobile menu        | None                | None              |
| 768px  | Mobile menu        | None                | None              |
| 1024px | Persistent sidebar | None                | None              |
| 1440px | Persistent sidebar | None                | None              |

The browser console contained only Vite connection messages and the React development-tools
suggestion. No React warnings or runtime exceptions were observed.

## Iteration history

1. Built the Tailwind token system, UI kit, and responsive shell.
2. Captured all representative viewports and compared the desktop shell with the approved mockup.
3. Corrected the sidebar width and corresponding content offset to prevent the brand from wrapping.
4. Repeated all viewport, overflow, navigation breakpoint, console, and screenshot checks.
5. Ran an independent acceptance review and corrected drawer resize cleanup, semantic chat speaker
   identity, and the remaining brand line wrap.
6. Repeated the 375px, 768px, 1024px, and 1440px browser checks after the acceptance fixes.

## Findings

- P0 blockers: none.
- P1 major issues: none.
- P2 minor issues: none within the Phase 11.0 scope.
- Deferred by task scope: full Dashboard content, real API data, authentication, document flows,
  and chat behavior.

## Final result

passed

---

# Phase 11.7D Controlled Browser QA Rerun

## Environment and scope

- Browser: controlled Codex in-app browser against the running Vite development server.
- Application path: real frontend, Express API, PostgreSQL, and Redis; the API and frontend health
  endpoints returned HTTP 200 and both Docker services reported healthy.
- QA data: one uniquely prefixed test user with one persisted `READY` document, one chunk, one
  conversation, two prepared turns, and one browser-submitted insufficient-context turn.
- Grounded browser rendering used a deterministic persisted citation fixture. The earlier Phase
  11.7D local integration run remains the evidence for real OpenAI generation and pgvector
  retrieval; those two halves were not repeated as one browser-to-provider scenario in this rerun.

## Verified browser evidence

| Scenario                  | Result                                                                                                                                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct conversation route | Passed after the StrictMode fix; title, ordered messages, citations, and composer loaded from the API.                                                                                                                |
| Citation rendering        | Passed for an ASSISTANT `[S1]` source showing the server-provided filename and `Page 12`; USER and insufficient-context messages showed no source section.                                                            |
| Citation navigation       | Passed; the semantic source link opened `/documents/phase117d-doc-20260801` and the matching ready Document Details page.                                                                                             |
| Direct refresh            | Passed; the canonical persisted thread, source card, and browser-submitted turn returned without duplicates.                                                                                                          |
| `Shift+Enter`             | Passed; the focused composer retained `First line\nSecond line` without submitting.                                                                                                                                   |
| Repeated Enter            | Passed; while the first submission was active the textarea was read-only, the second Enter did not create another turn, and the conversation message count changed from four to six.                                  |
| Insufficient context      | Passed for the browser-submitted question; the canonical persisted response rendered without source cards and survived refresh.                                                                                       |
| Semantics                 | The live DOM exposed one Chat page heading, navigation/region/list/article landmarks, labelled USER and ASSISTANT messages, a labelled composer, and a citation accessible name containing label, filename, and page. |
| React console             | Passed; no warning or error entries were observed after load, citation navigation, resize, submit, and refresh.                                                                                                       |

## Responsive evidence

| Viewport   | Result                                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1440 × 900 | No horizontal page overflow; conversation list and selected thread remained side by side.                                                                        |
| 1024 × 800 | No horizontal page overflow, but the selected thread was visually compressed by the persistent shell and conversation list. Exact 1024 × 768 remains unverified. |
| 390 × 844  | No horizontal page overflow; the selected route showed only the thread plus `Back to conversations`, and the composer remained operable after scrolling.         |

The mobile direct load started at the oldest visible message rather than the newest. This is a
recorded Phase 12 usability concern. The 1024 px density is also a polish concern; neither issue
changes API correctness or ownership boundaries.

## Defect found and fixed

React StrictMode aborts the first development-effect read before restarting it. The selected
conversation hook previously deduplicated only by conversation ID and could therefore return the
already-aborted promise to the restarted effect, leaving a direct route on `Loading conversation`
forever. The hook now reuses an in-flight read only while its AbortController is still live. A
focused hook regression simulates an aborted route-effect restart and requires a fresh request.

## Remaining Phase 11.7D browser gaps

- a real provider-grounded question, follow-up, title update, ordering update, and citation generated
  inside the same controlled-browser run;
- duplicate mouse click observed through an exact browser request log;
- exact network payload, request count, status, cookie, and absence-of-polling inspection;
- route switching during a delayed mutation and practical delayed stale-read/list-page scenarios;
- unavailable citation navigation, browser back/forward, and a direct selected conversation outside
  the visible list page;
- two QA users exercising foreign conversation and document URLs through public UI behavior;
- long/HTML-like filenames, duplicate/null-page citation variants, loading/error/unavailable states,
  and multiple source-card layout in the live browser;
- whitespace/empty/over-limit browser validation, IME composition, exact focus-order traversal,
  reduced motion, 200% zoom, and exact 1024 × 768 coverage.

## Final result

partially verified

---

# Phase 11.7D Final Acceptance Check

## Remaining scenarios completed

| Scenario            | Result                                                                                                                                                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New conversation    | Passed. The frontend used the server-generated CUID, opened the selected route, sent a first message and follow-up, updated the generated title/latest USER preview, and restored two complete turns after reload.                                                                                                       |
| Browser navigation  | Passed. Back returned to `/chat`; Forward restored the selected conversation with two USER and two ASSISTANT messages. Direct refresh preserved the same canonical thread.                                                                                                                                               |
| Foreign resources   | Passed in both directions with two isolated QA users. Foreign documents rendered the generic `Document not found` UI and foreign conversations rendered `Conversation unavailable`; no foreign filename, title, message, or citation data appeared.                                                                      |
| Message POST        | Passed. A temporary local QA proxy recorded one request per submission, cookie presence without its value, and exactly `{ "content": "..." }` bodies. History, citations, source/owner IDs, model configuration, and timestamps were absent.                                                                             |
| Route switching     | Passed. One matching POST was delayed for two seconds, the UI navigated from conversation A to B while it was active, B never showed A state, and returning to A loaded the one persisted USER/ASSISTANT turn. Database evidence showed six messages in A, two in B, and exactly one matching route-switch USER message. |
| Citation edge cases | Passed at 390 × 844. A `page: null` source omitted page text; a long `<script>…</script>` filename rendered literally, created no script element, retained a full accessible source name, stayed within a 238 px card, and produced no horizontal page overflow.                                                         |

## Runtime and cleanup evidence

- Browser: controlled Codex in-app browser using the real React frontend, Express API, PostgreSQL,
  and existing HttpOnly-cookie authentication flow.
- PostgreSQL and Redis were healthy; API health reported a connected database.
- Browser console findings: no warnings or errors.
- No new production defect was reproduced and no application or backend code changed.
- Two uniquely prefixed QA users and all related documents, conversations, and messages were
  removed; targeted post-cleanup counts were zero.
- The temporary proxy, request log, fixture SQL, registration responses, and all agent-started local
  processes were removed or stopped.

## Final result

complete

The next approved phase is Phase 12 — Product and Liquid Glass Polish.

---

# Phase 12.1 Visual Foundation and Liquid Glass Material System

## Reference and evidence

- Approved V3 reference:
  `/Users/Aismantas/.codex/generated_images/019f65ff-def7-7200-8446-26dae30ef9cc/exec-03c035b9-ee23-4b7f-a9d8-6aca4d85e76b.png`
- Reference dimensions and state: 1486 × 1058, authenticated desktop Chat Workspace, light theme.
- Primary implementation comparison:
  `output/phase12.1/comparison-sidebar-v3-vs-phase12.1.png`
- UI Kit material evidence: `output/phase12.1/ui-kit-materials-1440x900.png`.
- Full application evidence is stored under `output/phase12.1/` for Dashboard, Documents, Chat,
  and UI Kit at the representative viewports below.
- Browser: controlled Codex in-app browser against the real Vite frontend and local authenticated
  API session.

Phase 12.1 intentionally compares the V3 Sidebar material and selected-state language rather than
the complete V3 Chat composition. Chat layout, conversation rail, thread, citations, and Composer
remain Phase 12.2 work.

## V3 material comparison

| Area                | Result                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Sidebar hierarchy   | Passed. The production Sidebar is a distinct floating Navigation Glass surface while its text and icons remain immediately readable.          |
| Environmental edges | Passed. Neutral, cool-blue, and violet responses are localized and asymmetric; no continuous chromatic border or neon outline is present.     |
| Optical thickness   | Passed. A restrained outer rim, translucent transition, inner highlight, and soft elevation produce thin material depth without a large glow. |
| Selected navigation | Passed. The selected item uses shape, border, tonal layer, icon/text treatment, and route semantics rather than color alone.                  |
| Canvas              | Passed. Pale blue, indigo, violet, and faint warm fields remain background atmosphere and become more visible through material surfaces.      |
| Visual restraint    | Passed. The implementation is deliberately calmer and slightly more opaque than the concept render so daily-use readability remains primary.  |

The direct V3-to-production comparison did not justify increasing Sidebar edge intensity. The
implementation preserves the concept's asymmetric response but reduces the reference's stronger
illustrative glow to a maintainable production level.

## Material and elevation verification

- Navigation Glass is used by the global Sidebar and mobile drawer.
- Workspace Glass is available through the shared glass Card vocabulary and mobile workspace
  chrome.
- Solid Knowledge Surface remains nearly opaque for dense reading and information regions.
- Elevated Interaction Glass is used by dialogs, toasts, and elevated shared surfaces.
- Elevation is limited to 0 (content), 1 (workspace), and 2 (floating interaction).
- The no-backdrop-filter default uses opaque light backgrounds and clear borders; the blur and
  saturation treatment is added only inside a positive feature-support query.
- Reduced-motion rules remove non-essential animation and transitions, including processing spin
  where the existing component already provides a motion-reduce variant.

## Contrast measurements

| Combination                                         |   Ratio | Result         |
| --------------------------------------------------- | ------: | -------------- |
| Primary text on primary                             |  6.29:1 | Passed WCAG AA |
| Primary text on primary hover                       |  7.90:1 | Passed WCAG AA |
| Destructive text on destructive                     |  6.47:1 | Passed WCAG AA |
| Destructive text on destructive hover               |  8.31:1 | Passed WCAG AA |
| Ready text on Ready background                      |  6.49:1 | Passed WCAG AA |
| Processing text on Processing background            |  6.37:1 | Passed WCAG AA |
| Failed text on Failed background                    |  6.80:1 | Passed WCAG AA |
| Info text on Info background                        |  8.49:1 | Passed WCAG AA |
| Primary foreground on the lightest glass fallback   | 17.85:1 | Passed WCAG AA |
| Secondary foreground on the lightest glass fallback |  7.58:1 | Passed WCAG AA |
| Muted foreground on the lightest glass fallback     |  4.76:1 | Passed WCAG AA |

## Responsive and runtime checks

| Viewport   | UI Kit | Dashboard | Documents | Chat   | Horizontal page overflow |
| ---------- | ------ | --------- | --------- | ------ | ------------------------ |
| 1440 × 900 | Passed | Passed    | Passed    | Passed | None                     |
| 1024 × 768 | Passed | Passed    | Passed    | Passed | None                     |
| 390 × 844  | Passed | Passed    | Passed    | Passed | None                     |

The existing horizontally scrollable Documents status-control row remains visible at 1024 px;
Documents mobile-filter redesign is explicitly outside Phase 12.1. The existing 1024 px Chat
breakpoint is likewise deferred. Neither shared-foundation change introduced page-level overflow.

The in-app browser did not expose a reliable measurable browser-zoom value. Shared layout was
therefore additionally exercised at a 720 × 450 CSS viewport as a practical 200%-zoom layout
equivalent; it switched to the mobile shell, preserved readable controls, and introduced no
horizontal overflow. Exact browser-level 200% zoom remains part of the later full responsive and
accessibility campaign.

Keyboard focus was verified on the primary Button: the computed focused state used a 2 px solid
focus outline plus material-aware separation. The browser console contained no warning or error
entries after UI Kit and authenticated page navigation.

## Iteration history

1. Centralized the atmospheric, material, status, foreground, focus, and elevation tokens.
2. Separated typography metrics into `type-*` utilities so semantic `text-*` foreground utilities
   are no longer merged away.
3. Applied Navigation Glass and the selected-state layer to the shared App Shell and Sidebar, then
   mapped existing Card, Modal, Toast, Button, and StatusBadge variants to the shared vocabulary.
4. Added material, elevation, selected-state, contrast, focus, and disabled-state examples to UI
   Kit and corrected the stale upload copy.
5. Compared the V3 reference and production Sidebar side by side; retained the calmer edge-light
   calibration.
6. Browser QA found one stretched StatusBadge demonstration caused by the UI Kit flex container;
   `items-start` fixed the example without changing StatusBadge production behavior.
7. Repeated representative viewport, overflow, focus, contrast, console, and frontend regression
   checks.

## Findings

- P0 blockers: none.
- P1 major issues: none.
- P2 minor issues: no new Phase 12.1 defects remain.
- Intentional trade-off: the production material is more opaque and less luminous than the V3
  illustration to preserve long-session readability and a graceful no-blur fallback.
- Deferred by task scope: Chat V3 composition, 1024 px Chat breakpoint, mobile Chat scroll,
  Composer and citation redesign, Documents mobile filters, page-specific responsive polish,
  exact cross-browser 200% zoom, Safari/Firefox campaigns, route splitting, and dark mode.

## Final result

passed

The next approved phase is Phase 12.2 — Chat Workspace V3 Implementation.

---

# Phase 12.2 Chat Workspace V3 Implementation

## Reference and evidence

- Approved V3 reference:
  `/Users/Aismantas/.codex/generated_images/019f65ff-def7-7200-8446-26dae30ef9cc/exec-03c035b9-ee23-4b7f-a9d8-6aca4d85e76b.png`
- Reference dimensions and state: 1486 × 1058, authenticated desktop Chat Workspace, light theme.
- Full-frame V3 comparison: `output/phase12.2/v3-reference-vs-implementation-1440x900.png`.
- Focused material comparison: `output/phase12.2/v3-focused-reference-vs-implementation.png`.
- 1024 px defect comparison: `output/phase12.2/1024-before-vs-after.png`.
- Final viewport captures:
  - `output/phase12.2/implementation-v3-1440x900.png`
  - `output/phase12.2/implementation-v3-1280x800.png`
  - `output/phase12.2/implementation-v3-1024x768.png`
  - `output/phase12.2/implementation-v3-768x1024.png`
  - `output/phase12.2/implementation-v3-390x844.png`
- Additional state evidence: `output/phase12.2/mobile-conversation-list-390x844.png`,
  `output/phase12.2/empty-conversation-768x1024.png`, and
  `output/phase12.2/loading-conversation-1440x900.png`.
- Browser: controlled Codex in-app browser against the real Vite frontend, Express API,
  PostgreSQL, and Redis with a uniquely scoped QA account.

## V3 implementation comparison

| Area                       | Result                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Overall composition        | Passed. The authenticated Sidebar, Conversations rail, and selected workspace reproduce the V3 desktop hierarchy without adding unsupported actions.                           |
| Conversations rail         | Passed. The rail uses shared Workspace Glass, keeps ordinary rows quiet, and reserves the Liquid selected state for the active route.                                          |
| Workspace shell and header | Passed. The outer shell uses restrained Workspace Glass while the header reads as integrated workspace chrome rather than a separate decorative card.                          |
| USER message               | Passed. USER questions remain smaller, right-aligned, and visually secondary.                                                                                                  |
| ASSISTANT answer           | Passed. Dense grounded answers stay on near-opaque Solid Knowledge surfaces for reading clarity.                                                                               |
| Citations                  | Passed. Sources are stacked evidence rows; a long HTML-looking filename wraps safely, `page: null` omits page copy, and no source data is inferred.                            |
| Composer                   | Passed. The Composer uses Elevated Interaction Glass and a near-opaque input plane; the empty disabled Send state is deliberately quieter than the enabled V3 concept control. |
| Environmental edges        | Passed. Shared Phase 12.1 edges remain localized and asymmetric. No continuous chromatic border or additional shadow fog was introduced.                                       |

The production result is intentionally slightly more opaque and less luminous than the concept.
This preserves long-session readability, disabled-state clarity, and the existing opaque fallback
without weakening the V3 hierarchy.

## Responsive verification

| Viewport   | Layout result                                                                     | Horizontal overflow |
| ---------- | --------------------------------------------------------------------------------- | ------------------- |
| 1440 × 900 | Persistent Sidebar, Conversations rail, and selected thread                       | None                |
| 1280 × 800 | Compact but usable split workspace                                                | None                |
| 1024 × 768 | Persistent Sidebar plus route-based selected thread; Conversations rail is hidden | None                |
| 768 × 1024 | Mobile shell plus route-based selected thread                                     | None                |
| 390 × 844  | Mobile shell, wrapped title, readable thread and Composer                         | None                |

The split breakpoint moved from 1024 to 1280 px. This is based on usable reading width after the
272 px Sidebar, conversation rail, and gaps are subtracted, not on a generic device label. The
before/after evidence shows the previous 1024 px citations collapsing into letter-wide columns;
the final selected route gives the thread the full remaining workspace.

## Real-data and interaction verification

| Scenario                           | Result                                                                                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty conversation                 | Passed with a neutral empty state, real Composer, and no invented greeting.                                                                          |
| One and multiple turns             | Passed with canonical USER/ASSISTANT order. A newly created conversation accepted two real turns and retained four total messages.                   |
| Long answer and multiline question | Passed. Long plain text remained readable and the controlled multiline USER question preserved its line break.                                       |
| One and multiple citations         | Passed with backend order preserved.                                                                                                                 |
| Long and HTML-looking filename     | Passed as inert wrapping text; the browser contained no injected `img` or script element.                                                            |
| `page: null`                       | Passed; the accessible source name remained complete and page copy was omitted.                                                                      |
| Insufficient context               | Passed as a normal ASSISTANT answer with no source group.                                                                                            |
| Long title                         | Passed at desktop, tablet, and mobile widths without page overflow.                                                                                  |
| Loading                            | Passed through a controlled in-workspace delayed request; the rail stayed usable and the workspace showed its skeleton.                              |
| Error and unavailable              | Passed. A network interruption exposed the safe Retry state; a missing route used the generic unavailable state without ownership wording.           |
| New conversation                   | Passed. One click used the server-generated ID and opened the authoritative selected route.                                                          |
| Navigation                         | Passed for list selection, direct route, reload, Back, Forward, citation navigation, return from Document Details, and mobile Back to conversations. |
| Composer keyboard behavior         | Passed for Enter, Shift+Enter, submitting lock, and repeated Enter protection.                                                                       |

Two real browser submissions produced exactly two USER and two ASSISTANT rows in PostgreSQL;
repeated Enter created no duplicate. The unchanged focused service contract also requires exactly
one POST with only `{ content }`. Exact message payload/cookie inspection remains covered by the
completed Phase 11.7D acceptance run and was not redundantly proxied in this visual phase. No
polling, WebSocket, SSE, provider configuration, history, citation, or owner data was added to the
browser request path.

## Accessibility, fallback, and runtime observations

- The live DOM preserved one page heading, labelled workspace regions, semantic conversation
  links, ordered message articles, labelled USER/ASSISTANT roles, labelled citation links, and a
  labelled multiline Composer.
- Selected states use shape, fill, icon treatment, and `aria-current`; status is not color-only.
- Shared `focus-material` indicators remain on conversation and citation links; native Button and
  textarea focus behavior remains unchanged.
- Reduced-motion behavior remains centralized: transitions and animations collapse, and thread
  scrolling switches to `auto` when the media query matches. No new motion was added.
- No-backdrop-filter behavior remains an opaque light material with border and elevation; blur is
  added only inside the positive feature-support query.
- Browser console result: no warning or error entries after navigation, sending, citation use,
  responsive resizing, controlled recovery, and final reload.
- PostgreSQL and Redis remained healthy throughout the final checks. Expected controlled network
  and 404 states rendered safe UI and did not expose raw infrastructure or provider errors.

## Iteration history

1. Captured the pre-change Chat at 1440 × 900 and 1024 × 768 using controlled QA data.
2. Reused the Phase 12.1 material primitives rather than adding Chat-specific glass tokens.
3. Removed the redundant visible page introduction, retained the accessible page heading, and
   promoted the Chat panels to the primary workspace composition.
4. Changed the split threshold to 1280 px and verified the route-based tablet/mobile path.
5. Applied Workspace Glass to the rail and shell, the shared Liquid selected state to the active
   conversation, Solid Knowledge to answers, and Elevated Interaction Glass to the Composer.
6. Reworked citations from responsive columns into compact stacked evidence rows after the 1024 px
   baseline exposed destructive filename wrapping.
7. Compared the approved reference and implementation in the same full-frame and focused images;
   retained the calmer production edge and shadow calibration.
8. Exercised real creation, two turns, loading/error recovery, all citation edge cases, navigation,
   keyboard behavior, five viewports, console output, infrastructure health, and scoped cleanup.

## Findings

- P0 blockers: none.
- P1 major issue found and fixed: the old 1024 px three-column layout left the thread too narrow to
  read and broke long citation filenames. The split layout now starts at 1280 px.
- P2 minor issues: none remaining within Phase 12.2 scope.
- Intentional visual compromise: production glass is calmer and more opaque than the concept, and
  disabled Send is visibly subdued; both choices improve readability and state clarity.
- Deferred by task scope: Dashboard, Documents, Document Details, Auth, dialogs beyond shared
  materials, Documents mobile filters, Dashboard mobile restructuring, bundle splitting, dark
  mode, and all unsupported Chat features.
- QA cleanup: the isolated QA user and all related documents, conversations, and messages were
  deleted; targeted post-cleanup counts were zero. No queue jobs or storage objects were created.

## Final result

passed

The recommended next Phase 12 target is Phase 12.3 — Dashboard V3 Implementation. It remains a
recommendation until explicitly approved.

---

# Phase 12.2B Chat V3 Identity Calibration

## Reference and evidence

- Attached production reference: `/Users/Aismantas/Downloads/chat final.png`.
- Approved V3 reference:
  `/Users/Aismantas/.codex/generated_images/019f65ff-def7-7200-8446-26dae30ef9cc/exec-03c035b9-ee23-4b7f-a9d8-6aca4d85e76b.png`.
- Controlled browser baseline: `output/phase12.2b/a-current-1440x900.png`.
- Pass 1, atmosphere and Sidebar: `output/phase12.2b/pass-1-atmosphere-sidebar-1440x900.png`.
- Pass 2, rail, selected state, shell, and header:
  `output/phase12.2b/pass-2-workspace-materials-1440x900.png`.
- Pass 3, Composer and primary CTA: `output/phase12.2b/pass-3-composer-cta-1440x900.png`.
- Final calibrated production: `output/phase12.2b/c-calibrated-1440x900.png`.
- Baseline, V3, and calibrated comparison:
  `output/phase12.2b/three-way-material-comparison-1440x900.png`.
- Focused before/after comparison: `output/phase12.2b/focused-material-comparison.png`.
- Responsive captures: `output/phase12.2b/calibrated-1280x800.png`,
  `output/phase12.2b/calibrated-1024x768.png`, and
  `output/phase12.2b/calibrated-390x844.png`.
- Forced fallback capture: `output/phase12.2b/no-backdrop-filter-fallback-1440x900.png`.
- Browser: controlled Codex in-app browser against the real Vite frontend and Express API with an
  isolated local QA account and deterministic owner-scoped conversation data.

## Material comparison

| Area                       | Result                                                                                                                                                                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atmospheric canvas         | Passed. Chat receives modest localized cool-blue light at the left, pale violet between navigation and workspace, cool light at the upper-right, and a restrained blue-violet field behind the lower workspace. The fields are more visible through translucent surfaces than on empty canvas. |
| Sidebar                    | Passed. Chat-only Navigation Glass is slightly more translucent, uses a brighter top-left specular rim, a small cyan response on the exposed right side, a small violet response near the lower edge, and a quieter neutral elevation.                                                         |
| Conversations rail         | Passed. The rail is lighter and less opaque than Navigation Glass and Solid Knowledge. Normal rows remain integrated; only the selected row gains an additional thin material layer.                                                                                                           |
| Selected conversation      | Passed. The existing indigo selection is preserved with a short top-left neutral highlight and localized right-side indigo response. It remains clear without glow or a button-like gradient.                                                                                                  |
| Workspace shell and header | Passed. The shell is now restrained Workspace Glass around a solid ASSISTANT surface. The header uses a lighter translucent workspace-chrome plane and a refined lower edge without becoming a separate card.                                                                                  |
| Composer                   | Passed. The outer Interaction Glass shell is more translucent than its solid textarea, uses a local cool-blue left edge, restrained violet lower edge, and neutral upper-right specular, while remaining at the existing elevation level.                                                      |
| New conversation CTA       | Passed. The action remains solid indigo with controlled tonal depth, a small top specular, reduced diffuse shadow, and unchanged white contrast.                                                                                                                                               |
| ASSISTANT and citations    | Passed unchanged. They remain near-opaque reading/evidence surfaces and provide the stable center of the material hierarchy.                                                                                                                                                                   |
| Edge and shadow discipline | Passed. Environment-reactive color is confined to short local edge regions; no continuous chromatic border, global glow, new elevation level, or colored shadow fog was introduced.                                                                                                            |

The three-way comparison shows a meaningful but controlled move from repeated white SaaS cards
toward the intended material hierarchy. Production remains calmer than the concept: glass is
noticed after the information hierarchy rather than before it. The judged balance is approximately
70% calm professional workspace and 30% distinctive Developer Knowledge Hub material identity.

## Responsive, accessibility, and fallback verification

| Viewport or mode   | Result                                                                                                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1440 × 900         | Passed. Sidebar, rail, shell, solid answer, and Composer remain distinct without changing their geometry.                                                                                                                        |
| 1280 × 800         | Passed. The approved split view remains usable with no horizontal overflow.                                                                                                                                                      |
| 1024 × 768         | Passed. The selected route keeps the existing single-workspace path beside the desktop Sidebar; no horizontal overflow.                                                                                                          |
| 390 × 844          | Passed. The mobile shell, title, messages, citations, and Composer remain readable with no horizontal overflow.                                                                                                                  |
| No backdrop filter | Passed in a forced real-browser fallback render. Navigation, rail, shell, and Composer used their opaque base backgrounds (`0.92`, `0.91`, `0.91`, and `0.92` respectively), preserving hierarchy and readability at 1440 × 900. |

- The live DOM retained one accessible page heading, labelled USER and ASSISTANT messages, semantic
  conversation and citation links, `aria-current`, and complete source labels.
- Keyboard focus exposed the existing 2 px solid focus outline. Selection remains distinguishable
  through shape, fill, icon treatment, and semantics rather than color alone.
- The long HTML-looking filename rendered as inert text, preserved its complete accessible name,
  created no injected image, and did not overflow.
- Reduced-motion behavior remains centralized and unchanged; no motion was added.
- React console result: zero warning or error entries after the staged passes and responsive checks.

## Iteration history

1. Captured the real 1440 × 900 production baseline before code changes.
2. Pass 1 strengthened only the Chat atmosphere and Navigation Glass Sidebar, then captured and
   inspected the browser result.
3. Pass 2 calibrated only Conversations Workspace Glass, the selected layer, Chat shell, and
   workspace header, then captured and inspected the result.
4. Pass 3 calibrated only Composer Interaction Glass and the solid New conversation action, then
   captured and inspected the result.
5. Combined the current baseline, approved V3, and calibrated production in one comparison input.
   One final small opacity calibration made the rail, shell, and Composer materially distinct
   without increasing color or shadow intensity.
6. Verified the four required viewports, focus, semantic labels, safe hostile filename rendering,
   no horizontal overflow, console output, and a forced no-backdrop-filter browser render.
7. Ran 289 frontend tests plus TypeScript, web and root ESLint, web and root Prettier, and the
   production build; all passed. The known 517.77 kB bundle warning remains outside this phase.

## Findings

- P0 blockers: none.
- P1 major issues: none.
- P2 minor issues: none remaining within Phase 12.2B scope.
- Intentional compromise: localized edge light remains subtler than the concept at normal viewing
  distance so reading hierarchy and long-session calmness win over decorative material effects.
- Permanent identity rules supported by this pass: glass surrounds knowledge; Navigation Glass is
  the strongest passive material; Composer is the strongest interaction material; Workspace Glass
  is lighter than both; Solid Knowledge remains near-opaque; and environmental edge response is
  local, asymmetric, and subordinate to content.
- Layout, responsive architecture, behavior, frontend contracts, backend, API, Prisma, and data
  flow were unchanged.

## Final result

passed

The recommended next Phase 12 target remains Phase 12.3 — Dashboard V3 Implementation. It is not
approved until explicitly selected.

---

# Phase 12.4 Documents Library V3 Implementation

## Design source and workspace role

No separate Documents mockup was invented. The implementation applied the approved hierarchy in
order: production Chat supplied the Living Glass interaction/material identity, production
Dashboard supplied the operational information-density precedent, and the existing Documents
implementation remained the behavioral authority. Documents therefore reads as the product's
library/management workspace rather than another overview Dashboard or another conversational
Chat surface.

The material map is deliberately small:

| Area                          | Production role and result                                                                                                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App canvas and global Sidebar | The exact `/documents` route reuses the approved three-field Living Glass environment and signature Navigation Glass Sidebar. Document Details remains unchanged.                                         |
| Search and status controls    | One restrained Interaction Glass control bar groups real search and real processing filters. The search input and status chips remain stable, opaque controls within the glass region.                    |
| Document library              | One mostly opaque Solid Management surface contains the table/list, state messaging, result count, and pagination. Ambient light never passes through filename content strongly enough to impair reading. |
| Rows                          | Compact semantic rows with localized tint/focus feedback. They do not become floating glass cards and do not use lift or per-row shadow effects.                                                          |

The redundant `Knowledge library` eyebrow was removed so the real `Documents` heading and concise
description establish the hierarchy directly. Upload remains the clearly primary real action;
Refresh remains a compact secondary icon control with an accessible name.

## Behavior and state QA

- Existing cancellable Documents hooks and services were preserved: 350 ms trimmed filename-only
  search, page reset on search/status change, request abort and stale-response protection, 20-row
  pages, and search-scoped status counts that do not collapse around the selected status.
- Real Upload, Refresh, status filters, document links, result counts, Previous/Next pagination,
  and the existing upload dialog remain functional. No sort, tags, selection, row menu, direct
  Retry/Delete, polling, analytics, progress values, or new endpoint was introduced.
- Browser fixtures covered 23 mixed documents, 17 Ready, 6 Processing, an earlier six Failed
  documents, a one-document search result, zero documents, a final three-row pagination page,
  long and Lithuanian filenames, and an HTML-looking filename. The HTML-like content remained an
  inert text node and retained its complete accessible link name; no script element appeared.
- Zero library uses onboarding language and the real Upload action. A long unmatched query uses a
  distinct `No documents found` state with Clear search. A selected Failed filter with a real zero
  count uses `No failed documents`; it does not reuse onboarding or search language.
- Loading keeps the stable solid library geometry with accessible row/footer skeletons. A real
  API pause produced the library-scoped connection error; Retry restored the authoritative
  23-document result without reloading the shell.

## Responsive and accessibility acceptance

- 1440 × 900 passed with the full five-column information grid, 20 compact rows, integrated
  result count/pagination, and intentional use of the available management-workspace width.
- 1280 × 800 passed with the full grid and no clipped filters or horizontal overflow.
- 1024 × 768 passed by changing representation: the column header is removed and each document
  becomes a compact semantic list row with filename first and supporting status/size/date metadata.
- 390 × 844 passed with the existing mobile shell, full-width Upload, 44 px Refresh, a 2 × 2 filter
  grid, readable wrapped/truncated filenames, and no horizontal page scrolling.
- The Search control has an accessible name and one clear action; the browser-native duplicate
  cancel decoration is suppressed. Upload, Refresh, filters, filenames, empty-state actions, and
  pagination retain semantic button/link behavior and visible focus treatment. A standalone
  keyboard trace verified Search → Clear search → All → Ready → Processing → Failed.
- Long filenames wrap or truncate within their available region and never push status or metadata
  outside the workspace. Status meaning remains explicit text, not color alone.

## Motion, fallback, console, and network

- Explicitly authorized one-time standalone Playwright QA confirmed
  `prefers-reduced-motion: reduce`. All three ambient fields remained visible but computed to
  `animation-name: none`, `transform: none`, and `will-change: auto`; no Documents-library element
  retained an active animation.
- The forced unsupported-backdrop path produced `backdrop-filter: none`, a readable 94% opaque
  control bar and Sidebar, and the unchanged 97% opaque Solid Management surface. The layout had
  no horizontal overflow.
- Browser console, page-error, and relevant request-failure collections were empty in final QA.
- Network observation recorded exactly one successful `GET /api/documents` for initial load, one
  for the debounced search, one for the status change, and one for Refresh. All used the existing
  credentialed API flow and returned 200; no duplicate loop or visual-only fake request appeared.
- CSS-only material changes add no new effects, timers, subscriptions, fetches, or application
  state. Blur remains limited to navigation/control glass; the dense library has no backdrop
  filter, keeping compositing cost bounded.

## Reviewer synthesis

- Exactly two mandatory reviewers completed read-only work before MAIN modified production files.
  Reviewer A audited library/product UX; Reviewer B audited frontend architecture, contracts,
  responsive risk, and tests. The pre/post source-and-doc checksum remained
  `7a3a19d0372a62b76459f407f0e37627561c187be4c454a82ebcfc1a175900c6`, confirming neither reviewer
  changed project files.
- Both agreed to remove the eyebrow, use one Interaction Glass toolbar, retain one solid library,
  preserve existing service/hook behavior, reject row-card/glass proliferation, and switch to a
  compact list below the desktop table breakpoint.
- Their only practical tension was breakpoint proof. MAIN resolved it through measured browser
  acceptance: the full grid begins at 1280 px (`xl`), while 1024 and mobile use the compact list.
- Accepted recommendations include filename-first hierarchy, real count visibility, integrated
  pagination, restrained selected-state treatment, stable empty/loading/error surfaces, and
  expanded desktop use. Fake controls, visual redesign of Chat/Dashboard, and broader Documents
  functionality were rejected or deferred.

## Files and verification

- Production/component changes: `AppShell.tsx`, `DocumentsPage.tsx`, `DocumentFilters.tsx`,
  `DocumentList.tsx`, `DocumentListItem.tsx`, `DocumentsEmptyState.tsx`, `SearchInput.tsx`, and
  `globals.css`.
- Focused tests updated: `app.test.tsx` and `documents-page.test.tsx`, covering exact-route ambient
  scope, eyebrow removal, and long HTML-looking filename safety/accessibility.
- Frontend regression: 28 files, 291/291 tests passed.
- `npm run typecheck:web`, `npm run lint:web`, web Prettier, root ESLint, and root Prettier passed.
- `npm run build:web` passed. The output is now 520.37 kB minified (154.40 kB gzip) and retains the
  known over-500 kB warning deferred to Phase 14.
- PostgreSQL and Redis were healthy. Both isolated Phase 12.4 QA users and all 23 temporary
  documents were removed; targeted counts returned zero. No queue jobs or storage objects were
  created by this visual acceptance.
- Evidence is stored in `output/phase12.4/`, including 1440, 1280, 1024, 390, one/zero/no-result,
  final-page, loading, error, keyboard-focus, reduced-motion, and no-backdrop-filter captures plus
  `standalone-acceptance-results.json`.

## Final result

passed

Phase 12.4 is complete. Documents now belongs unmistakably to the same product as Chat and
Dashboard while establishing its own calm, dense, trustworthy management/library archetype.
Chat and Dashboard were not visually redesigned; the Chat Composer rim debt, backend/API/Prisma/
RAG contracts, branding, dependencies, and Phase 14 bundle optimization were not changed.

At the time of this Phase 12.4 record, the next target was Phase 12.5 — Document Details V3.
Phase 12.5 has since been completed; its final acceptance record appears below.

---

# Phase 12.3 Dashboard V3 Implementation

## Source hierarchy and evidence

- Material/identity source of truth: approved production Chat, including its shared token system,
  three-field ambient environment, Navigation Glass Sidebar, localized asymmetric edges, and
  stable Solid Knowledge reading surfaces.
- Structure/content-hierarchy source: `/Users/Aismantas/Downloads/Generated image 1 (2).png`.
- Behavior/data source: the existing production Dashboard components, hooks, services, schemas,
  routes, tests, and real API responses.
- Empty Dashboard: `output/phase12.3/empty-dashboard-1440x900.png`.
- Populated implementation: `output/phase12.3/implementation-dashboard-v3-1440x900.png`.
- Full reference/implementation comparison:
  `output/phase12.3/reference-vs-implementation-1440x900.png`.
- Focused hierarchy/material comparison: `output/phase12.3/focused-material-comparison.png`.
- Keyboard focus evidence: `output/phase12.3/keyboard-focus-1440x900.jpg`.
- Final acceptance viewports: `output/phase12.3/acceptance-1280x800.png`,
  `output/phase12.3/acceptance-1024x768.png`, and
  `output/phase12.3/acceptance-390x844.png`.
- Final state evidence: `output/phase12.3/acceptance-loading-1280x800.png`,
  `output/phase12.3/acceptance-error-1280x800.png`,
  `output/phase12.3/acceptance-reduced-motion-1280x800.png`, and
  `output/phase12.3/acceptance-no-backdrop-filter-1280x800.png`.
- Machine-readable acceptance measurements: `output/phase12.3/acceptance-matrix-results.json`.
- The source image is 1536 × 1024 and the controlled implementation viewport is 1440 × 900 at
  density 1. Comparison canvases use containment rather than stretching, so neither source is
  geometrically distorted.

## Material and hierarchy result

- One AppShell-level ambient layer now serves Dashboard and Chat. The three existing field
  definitions, transform-only motion, mobile intensity reduction, reduced-motion rule, and opaque
  fallback remain unchanged.
- The shared Sidebar uses the exact approved Living Glass Navigation material on both routes.
  Chat-only rail, workspace, header, CTA, and Composer selectors remain Chat-scoped.
- Upload document and New chat are equal real navigation actions using restrained Interaction
  Glass, one indigo product family, compact Lucide assets, and localized edge response. No giant
  cloud/chat artwork or green secondary brand treatment was recreated.
- Statistics use real API totals and grouped Ready/Processing/Failed semantics on mostly-solid
  surfaces. Semantic color is confined to compact icon fields; no status glow was added.
- Recent documents, Recent conversations, onboarding, and attention/failed content use stable
  Solid Knowledge surfaces. The wide lower hierarchy is three columns at 1360 px and above, two
  columns with attention spanning the row at 1280–1359 px, and one column below 1280 px.
- Global search was omitted because Dashboard has no supported search contract. Inline Retry,
  overflow menus, processing percentages, activity, analytics, billing, theme controls, and
  timezone messaging were also rejected as unsupported or unnecessary.

## State, interaction, accessibility, and browser observations

- Populated and empty states passed in the controlled 1440 × 900 browser. Counts were real and
  internally consistent; Upload opened `/documents`; New chat opened `/chat`; Browser Back returned
  to the authoritative Dashboard.
- An unusually long document filename and conversation title truncated without horizontal
  overflow. `API Reference <script>alert(1)</script>.pdf` rendered as literal text, with zero script
  elements inside `main`.
- The page measured 1440 CSS pixels wide with no horizontal overflow. At 1440, the lower sections
  computed to three equal 346.66 px columns and shared the same vertical start.
- Primary links measured 112 px high. Secondary section links measured 40 px high, conversation
  rows measured 56 px, and none reported content overflow.
- Keyboard navigation produced the shared 2 px indigo focus ring with a 3 px offset and white
  separation ring on the selected Dashboard navigation link.
- The decorative ambient layer has exactly three non-interactive, accessibility-hidden fields.
  Statistics use definition-list semantics; status meaning is conveyed through icon plus text.
- Browser logs contained no React warning or error. Only expected Vite connection/HMR and React
  DevTools development messages were present.
- No new network-capable code was added. Existing independent document, conversation, and failed
  document requests, cancellation, retry locking, validation, and owner-scoped contracts remain
  unchanged. Exact request counts were covered by the existing hook/service regression tests, not
  by new browser instrumentation.

## Final acceptance matrix

- 1280 × 800 passed at density 1 with no horizontal overflow. The lower layout used two 450 px
  columns and placed the attention section on a full-width second row; the four statistics remained
  in one row.
- 1024 × 768 passed at density 1 with no horizontal overflow. The lower sections became one 664 px
  column and the statistics became a balanced two-column grid.
- 390 × 844 passed at density 1 with no horizontal overflow. Desktop navigation was replaced by
  the mobile header, primary actions stacked to 358 px, and statistics retained a two-column
  mobile layout.
- Loading passed with one accessible overview status and three list skeleton regions. Error passed
  with accessible retry alerts while the independently successful conversations resource remained
  available. The only console errors were the two expected `503` resource messages deliberately
  created by the QA interception; there were no page errors or failed browser requests.
- Reduced motion passed: the media query matched and all three ambient fields computed to no
  animation, no transform, and no `will-change` promotion.
- The no-backdrop-filter fallback passed using a QA-only forced base-material render. Navigation
  computed to an opaque `rgba(255, 255, 255, 0.92)` surface and Dashboard actions to
  `rgba(255, 255, 255, 0.9)`, both with `backdrop-filter: none`; layout and readability remained
  intact.
- Long and HTML-looking fixture names remained plain text, truncated safely, and introduced no
  script element or horizontal overflow.

## Automated verification

- Focused Dashboard/AppShell suite: 3 files, 29/29 tests passed.
- Frontend regression: 28 files, 290/290 tests passed.
- `npm run typecheck:web`: passed.
- `npm run lint:web`: passed.
- Root Prettier check: passed.
- `npm run build:web`: passed with the existing 517.91 kB JavaScript chunk-size warning.
- Automated tests cover independent loading, error, retry, empty, populated, navigation, safe
  unsupported-control exclusion, and request cancellation behavior.
- The final matrix used the explicitly authorized one-time standalone Playwright runtime for QA
  only. Playwright was not added to the repository or its dependency graph.

## Reviewer resolution

- Both mandatory reviewers were read-only and the before/after review checksum remained
  `978f53e4d06b7bd0f866d1edfb93a688ebac3c6d9f0cced18fddf1b482d4c7ae` before MAIN edits.
- Accepted from both: preserve the three-request architecture; reuse one shared ambient layer and
  Sidebar; keep actions restrained and indigo; keep statistics near-solid and lower panels solid;
  omit fake search and direct Retry; improve touch targets, wrapping, truncation, and the wide
  three-column lower hierarchy.
- Modified: the optional timezone footer was omitted; attention navigation says `Open documents`
  instead of implying an unsupported failed-only route; mobile statistics use a compact two-column
  reflow; the empty onboarding panel remains but is a compact solid strip rather than a third hero.
- Deferred: URL-backed failed filtering and direct retry belong to a separately approved product
  task. Rejected: ornamental artwork, green secondary branding, glow-heavy cards, activity,
  percentages, charts, menus, analytics, duplicate account chrome, and per-card ambient fields.
- The reviewers had no material disagreement. Reviewer B emphasized semantic metrics and absolute
  date accessibility; metric semantics were accepted, while visible absolute dates were deferred
  because changing the existing compact date presentation was not required for this visual phase.

## Severity and final result

- P0 blockers: none.
- P1 major defects: none.
- P2 visual defects: none observed across the completed responsive and forced-state matrix.
- Verification gap: none for Phase 12.3 acceptance.

## Final result

passed

Phase 12.3 is complete. The recommended next product surface is Phase 12.4 — Documents Library V3
Implementation.

---

# Phase 12.2C Dynamic Ambient Refraction and Living Glass

## Evidence

- Phase 12.2B baseline: `output/phase12.2c/a-phase12.2b-baseline-1440x900.png`.
- Ambient-only pass: `output/phase12.2c/b-pass1-ambient-1440x900.png`.
- Navigation and Conversations pass: `output/phase12.2c/c-pass2-navigation-1440x900.png`.
- Workspace and Composer pass: `output/phase12.2c/d-pass3-workspace-1440x900.png`.
- Final immediately after load: `output/phase12.2c/e-final-immediate-1440x900.png`.
- Final after 15 seconds of field motion:
  `output/phase12.2c/f-final-after-motion-1440x900.png`.
- Baseline/immediate/motion comparison:
  `output/phase12.2c/g-baseline-immediate-motion-comparison.png`.
- Responsive captures: `output/phase12.2c/final-1280x800.png`,
  `output/phase12.2c/final-1024x768.png`, and `output/phase12.2c/final-390x844.png`.
- Forced opaque fallback: `output/phase12.2c/h-no-backdrop-filter-fallback-1440x900.png`.
- Forced reduced-motion CSS path: `output/phase12.2c/i-reduced-motion-static-1440x900.png`.
- Keyboard focus evidence: `output/phase12.2c/j-keyboard-focus-1440x900.png`.

## Material and motion results

| Area                    | Result                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ambient architecture    | Passed. One fixed, pointer-inert, `aria-hidden` AppShell layer is rendered only on Chat routes and contains exactly three diffuse light fields beneath all structural surfaces.                                           |
| Motion                  | Passed. Only field transforms animate. The independent 37, 43, and 34 second cycles use negative delays, alternate direction, 22–28 px maximum desktop travel, and no opacity, blur, border, shadow, or layout animation. |
| Perceived movement      | Passed. All three computed transforms changed after 15 seconds, while the comparison remains visually stable at normal viewing distance. The environment shifts; the UI does not.                                         |
| Sidebar and rail        | Passed. Supported-browser alpha moved conservatively to `0.65` and `0.63`; localized edge response was reduced so it does not become a continuous gradient outline.                                                       |
| Chat shell and Composer | Passed. Supported-browser alpha moved to `0.67` and `0.63`, with the dock at `0.10`. Stable knowledge and textarea planes continue to carry readability.                                                                  |
| Solid content           | Passed unchanged. ASSISTANT, citation, USER, textarea/input, selected content, and solid CTA surfaces do not animate and were not made ambient-driven factual surfaces.                                                   |
| Mobile calibration      | Passed. Below 640 px the ambient fields are quieter, use 10–15 px paths and at most `1.018` scale, while shell/header/Composer chrome becomes more opaque.                                                                |
| Reduced motion          | Passed through a forced real-browser CSS-path check. All fields reported `animation-name: none`, `transform: none`, and `will-change: auto`; the static atmosphere remained present.                                      |
| No backdrop filter      | Passed through a forced real-browser fallback. Sidebar, rail, shell, and Composer retained their opaque `0.92`, `0.91`, `0.91`, and `0.92` base backgrounds.                                                              |

## Responsive, accessibility, performance, and behavior

- 1440 × 900, 1280 × 800, 1024 × 768, and 390 × 844 passed without geometry changes or
  horizontal overflow; measured document widths matched each viewport exactly.
- The decorative layer has no focusable descendants, is hidden from the accessibility tree, and
  cannot intercept pointer input. The existing Chat link retained a visible 2 px solid focus ring
  with a 3 px offset.
- Muted metadata, long citation names, message copy, helper copy, and the textarea placeholder
  remained readable at the inspected immediate and shifted field positions.
- React emitted no errors or warnings. Browser logs contained only expected Vite development and
  React DevTools messages during reload/HMR checks.
- The new component is static markup and the material implementation is CSS-only: it contains no
  effects, timers, fetch/XHR calls, polling, subscriptions, or product-state code. Request-facing
  modules and backend contracts were untouched.
- PostgreSQL and Redis were healthy. The isolated QA user and its cascade-owned conversations and
  messages were removed; the targeted email count returned zero. No document, storage object,
  worker job, or queue job was created by this visual QA fixture.

## Reviewer resolution

- Material reviewer recommendations accepted: one three-field workspace layer; stable solid
  knowledge surfaces; reduced static edge intensity; responsive field placement; and rejection of
  visible blobs, full chromatic outlines, and per-panel light sources.
- Material reviewer opacity ranges were modified conservatively: the final desktop reductions are
  smaller than the broadest suggestion because direct comparison showed that the new environment
  already supplies most of the missing refraction.
- Motion/accessibility/performance reviewer recommendations accepted: transform-only 34–43 second
  cycles, negative delays, explicit reduced-motion cleanup, mobile path reduction, constant
  opacity, and no animated filters, borders, shadows, or UI surfaces.
- The suggestion to keep all existing desktop alpha values was modified after staged browser
  comparison: only 0.03–0.05 reductions were applied. No recommendation required a deferred product
  change, and additional fields, JavaScript animation, and UI-surface motion were rejected.

## Verification

- Focused App Shell test: 17/17 passed.
- Frontend regression: 28 files, 290/290 tests passed.
- `npm run typecheck:web`: passed.
- `npm run lint:web`: passed.
- `npm run build:web`: passed with the known 518.15 kB bundle-size warning.
- Web and root Prettier checks: passed.
- Root ESLint: passed.

## Final result

passed

The recommended next Phase 12 target remains Phase 12.3 — Dashboard V3 Implementation. It is not
approved until explicitly selected.

---

# Phase 12.2D Glass Transparency Calibration and Composer Rim Cleanup

## Evidence

- Phase 12.2C baseline: `output/phase12.2d/a-baseline-1440x900.png`.
- Staged Sidebar and Conversations passes: `output/phase12.2d/b-pass1-sidebar-1440x900.png` and
  `output/phase12.2d/c-pass2-rail-1440x900.png`.
- Composer idle and focused states: `output/phase12.2d/d-pass3-composer-idle-1440x900.png` and
  `output/phase12.2d/e-pass3-composer-focus-1440x900.png`.
- Living Glass motion sample: `output/phase12.2d/f-motion-immediate-1440x900.png` and
  `output/phase12.2d/g-motion-after-15s-1440x900.png`.
- Responsive captures: `output/phase12.2d/h-final-1280x800.png`,
  `output/phase12.2d/i-final-1024x768.png`, `output/phase12.2d/j-final-390x844.png`, and
  `output/phase12.2d/k-final-mobile-sidebar-390x844.png`.
- Forced fallback and reduced-motion paths:
  `output/phase12.2d/l-forced-no-backdrop-fallback-1440x900.png` and
  `output/phase12.2d/m-forced-reduced-motion-1440x900.png`.
- Direct reference/implementation comparison:
  `output/phase12.2d/n-reference-implementation-comparison.png`.

## Material results

- The active Chat navigation material was inspected as a layered indigo/violet selected surface
  over a neutral white base with a restrained inset highlight, low indigo shadow, and localized
  asymmetric masked edge.
- Supported-browser Sidebar material moved from solid white at `0.65` to a restrained white/indigo
  tint (`0.18` to `0.08`) over white `0.48`. The rail moved from solid white at `0.63` to a quieter
  white/violet tint (`0.14` to `0.07`) over white `0.44`.
- Sidebar, rail, and active Chat now read as one family while preserving their roles: Navigation
  Glass remains optically stronger, the rail remains subordinate, and the selected item floats as
  an additional layer. Existing edge opacity did not need strengthening or reduction.
- That pass removed the dedicated `chat-composer-shell::before` inset-shadow stack, including its
  2 px white optical-thickness stroke. Final Phase 12.5 inspection later proved that a separate
  continuous band remained because the outer shell exposed 8 px of its own translucent background.
  Phase 12.5 records the final root cause and correction below.

## Responsive, fallback, accessibility, and motion

- 1440 × 900, 1280 × 800, 1024 × 768, and 390 × 844 retained the approved layout and had no
  horizontal overflow. Mobile supported-browser opacity remains the denser `0.78` Sidebar and
  `0.74` rail recipe.
- The forced no-backdrop-filter path retained opaque Sidebar `0.92`, rail `0.91`, and Composer
  `0.92` surfaces. Text and selected states remained readable.
- The textarea matched `:focus-visible`; its input boundary strengthened and retained the existing
  visible 3 px focus-within ring while the removed pseudo-element remained absent.
- All three ambient fields retained the approved 37, 43, and 34 second animations. Their computed
  transforms changed during the 15-second sample without visible blobs or neon edges. In the
  forced reduced-motion path all fields reported `animation-name: none`, `transform: none`, and
  `will-change: auto`.
- React emitted no unexplained warning or error during staged, responsive, fallback, and motion QA.

## Verification

- Frontend regression: 28 files, 290/290 tests passed.
- `npm run typecheck:web`: passed.
- `npm run lint:web` and root `npm run lint`: passed.
- Web and root Prettier checks: passed.
- `npm run build:web`: passed with the existing 518.15 kB chunk-size warning.
- Backend, API, Prisma, RAG, layout, responsive architecture, ambient definitions, dependencies,
  and product behavior were unchanged.

## Final result

passed

The recommended next Phase 12 target remains Phase 12.3 — Dashboard V3 Implementation. It is not
approved until explicitly selected.

---

# Phase 12.5 Document Details V3 and final Phase 12 product acceptance

## Read-only review and resolution

- Subagent A reviewed the real document lifecycle, worker transitions, public grouping, Retry,
  Delete, and ownership behavior. Subagent B independently reviewed the Details frontend,
  responsive/accessibility behavior, shared materials, and the remaining Chat Composer rim.
- Both assignments were explicitly read-only. A SHA-256 workspace checksum was identical before
  and after their reviews; neither reviewer changed files, dependencies, configuration, Git state,
  or data.
- Both recommended the same three user-facing lifecycle groups: Ready (`READY`), Processing
  (`PENDING`, `PROCESSING`, `CHUNKS_READY`, `EMBEDDING`), and Failed (`FAILED`). Both rejected fake
  progress, ETA, technical stage history, unsupported document actions, and broader backend work.
- MAIN adopted their shared material hierarchy and mobile ordering. There was no substantive
  disagreement. MAIN used measured browser QA to calibrate the narrow decision rail and hostile
  filename handling.

## Document Details result

- `/documents/:documentId` now uses the existing three-field Living Glass environment and frozen
  Navigation Glass Sidebar. No new field, color, animation, or material family was introduced.
- The top identity/Refresh layer uses restrained Interaction Glass. Document Information,
  Processing Status, Retry recovery, and Document Management use near-opaque Solid
  Knowledge/Decision surfaces.
- Desktop uses a factual information column plus a smaller lifecycle/decision rail. Mobile order is
  Back, identity, lifecycle/recovery, information, then management. Ready management remains below
  the initial mobile viewport instead of competing with status.
- Retry remains available only for Failed. Delete remains available for every successfully loaded
  state. Refresh remains manual. Their existing confirmation, pending, duplicate-submit,
  stale-response, safe-error, navigation, and mutual-exclusion behavior did not change.
- Normal, very long, Unicode, symbol-heavy, and `<script>`-looking filenames remain inert React
  text. The identity heading is visually clamped while retaining its full accessible name/title;
  metadata wraps safely. Browser QA found no injected element and no horizontal overflow.
- Loading preserves the Details geometry without displaying a false status. API error remains a
  localized solid surface. Missing, foreign-owned, and soft-deleted resources retain one generic
  `Document not found` experience with no ownership disclosure.
- Back, Refresh, Retry, Delete, mobile navigation, and dialog controls retained practical 44 px
  targets in the tested product paths. Retry/Delete dialogs initially focus their safe Close
  control, close with Escape, and restore focus to the invoking button.

## Composer debt closed

- Final DevTools measurement proved that `chat-composer-shell::before` was already inactive
  (`box-shadow: none`). The remaining continuous white rim was the outer shell's own `p-2`: 8 px of
  translucent white material was visible around the solid input plane, reinforced by the shell
  border, inset highlight, and elevation.
- The shell separation is now `p-px`. Acceptance measured a 1 px exposed material edge, retained
  the real 1 px inner input border, and preserved the existing focus-within treatment, Composer
  elevation, textarea readability, Send behavior, layout, and responsive behavior.
- No Chat, Dashboard, or Documents redesign was performed. This was the explicitly approved shared
  visual-debt correction only.

## Product-wide acceptance

- Thirty-five controlled browser scenarios covered Login, Register, Dashboard, Documents, empty
  and populated Chat, Document Details, upload, Delete and Retry dialogs, mobile navigation, and the
  UI Kit.
- Details passed at 1440 × 900, 1280 × 800, 1024 × 768, 768 × 1024, and 390 × 844. Product anchors
  were rechecked at representative desktop, tablet, and mobile widths. No scenario had horizontal
  overflow.
- All four technical transitional states rendered the same truthful Processing presentation with
  no percentage, ETA, queue position, chunk stage, or embedding-stage claim. Ready and Failed used
  the established mint and coral semantics with icon plus text.
- Forced loading, API error, unavailable, empty, reduced-motion, and no-backdrop-filter states
  passed. Reduced motion reported `animation-name: none` and `transform: none` on all three ambient
  fields. The forced fallback used an opaque `rgba(255, 255, 255, 0.94)` identity surface with no
  backdrop filter.
- Details network inspection recorded one initial GET, exactly one additional GET for manual
  Refresh, and no request after the idle observation window. No polling or new endpoint appeared.
- React emitted no unexplained warning, error, key warning, render loop, or state-update-after-
  unmount defect. Expected browser network logging was limited to unauthenticated `/auth/me`, the
  deliberately forced 404/503 responses, and requests aborted when isolated QA contexts closed.
- PostgreSQL and Redis were healthy. The single isolated Phase 12.5 QA user was removed and a
  targeted database count returned zero. The acceptance created no document, storage object, AI
  request, BullMQ job, or queue residue.

## Automated verification

- Frontend regression: 28 files, 292/292 tests passed.
- `npm run typecheck:web`: passed.
- `npm run lint:web` and root `npm run lint`: passed.
- Web and root Prettier checks: passed.
- `npm run build:web`: passed.
- The production JavaScript chunk is 520.75 kB minified (154.50 kB gzip). The known over-500 kB
  warning remains intentionally deferred to Phase 14, where code splitting can be evaluated with
  production performance evidence rather than mixed into the design freeze.
- Backend/API/Prisma/RAG contracts, dependencies, product branding, logo, and Phase 13–16
  implementation were unchanged.

## Evidence

- Real READY baseline and implementation: `output/phase12.5/01-baseline-ready-1440.png` and
  `output/phase12.5/03-details-ready-after.png`.
- Composer before/final evidence: `output/phase12.5/02-composer-idle-before.png`,
  `output/phase12.5/04-composer-rim-after.png`, and
  `output/phase12.5/acceptance/chat-composer-idle-1280x800.png`.
- Responsive, lifecycle, dialogs, hostile filename, loading, error, unavailable, mobile navigation,
  fallback, authentication, Dashboard, Documents, Chat, and UI Kit captures are in
  `output/phase12.5/acceptance/`.
- Machine-readable results: `output/phase12.5/acceptance/phase12.5-acceptance-results.json`.

## Final result

passed

Phase 12 — Product and Liquid Glass polish is complete and frozen. The implemented identity is
codified in `docs/design-manifesto.md`. No unresolved Phase 12 Critical or High visual/accessibility
issue remains. The next approved project phase is Phase 13 — Security hardening and OWASP
verification.
