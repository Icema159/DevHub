# UR-001A — Technical QA

- **Author role:** Codex — Implementation Engineer
- **Status:** `READY_FOR_HUMAN_REVIEW`
- **Reviewed artifact and revision:** `implementation-experiment.md`, local uncommitted revision,
  2026-08-29
- **Review date:** 2026-08-29
- **Production-code changes made:** Yes — frontend-only isolated development experiment

## Verdict

`READY_FOR_HUMAN_REVIEW`

The isolated implementation and automated regression suite pass. The calibrated 1440 × 900 state
has been inspected; the remaining responsive/state browser matrix still needs a fresh browser run.
This verdict makes the experiment ready for human comparison, not product-wide rollout.

## Evidence inspected

- default real Chat route at 1440 × 900:
  `output/ur-001a-chat-dark-v4/current-chat-1440x900.png`;
- initial experimental route at 1440 × 900:
  `output/ur-001a-chat-dark-v4/dark-v4-1440x900.png`;
- real conversation history, insufficient-context answer, grounded answers, and real source cards;
- route, component, CSS, and test diffs;
- full Web tests, typecheck, lint, formatting, production build, production-route exclusion check,
  and `git diff --check`.
- current controlled-browser capture at 1440 × 900;
- historical V4 captures for the other responsive and state variants (not treated as final V4.1
  evidence);
- direct Claude source-to-DevHub implementation comparison.

## Findings

### TQA-001 — Light utilities overrode three Dark V4 surfaces

- **Severity:** Important
- **Area:** Visual / Accessibility
- **Observation:** The initial browser capture showed white source receipts and composer input plus
  an overly gray conversation-rail header inside the dark experiment.
- **Evidence:** `output/ur-001a-chat-dark-v4/dark-v4-1440x900.png`.
- **Risk:** Evidence text lost contrast and the visual system looked partially themed.
- **Recommended change:** Apply higher-specificity route-scoped dark fills to those semantic class
  hooks without changing the default Chat utilities.
- **Acceptance condition:** Repeat the same state at 1440 × 900 and confirm readable dark receipts,
  composer, and rail header.
- **Disposition:** Resolved. Corrected dark source receipts, Composer, and conversation-rail header
  were browser-verified.

### TQA-002 — Final responsive/fallback browser matrix

- **Severity:** Open — verification gap
- **Area:** Responsive / Accessibility / Engineering
- **Observation:** The current in-app browser reached its usage limit after the calibrated 1440 × 900
  capture, so the V4.1 responsive/state rerun could not be completed.
- **Evidence:** `output/ur-001a-chat-dark-v4/dark-v4-1-1440x900.png`; historical V4 captures remain
  in the same directory.
- **Risk:** Visual regressions at the remaining viewports or fallback/state combinations are not
  ruled out by the current turn.
- **Disposition:** Re-run once browser inspection is available; no production code change is
  indicated by the current evidence.

### TQA-003 — Mobile and error controls inherited light utility surfaces

- **Severity:** Important
- **Area:** Responsive / Visual
- **Observation:** The first standalone captures showed a light mobile header/drawer close control
  and a light error-state Retry button inside the otherwise dark experiment.
- **Evidence:** Initial QA captures before the final route-scoped correction.
- **Risk:** The experiment identity appeared incomplete and Retry readability was reduced.
- **Recommended change:** Add only route-scoped high-specificity dark surface and foreground rules.
- **Acceptance condition:** Re-run the affected mobile navigation and error checks.
- **Disposition:** Resolved. The final 390 × 844 drawer and 1440 × 900 error captures passed.

## Confirmed strengths

- The default `/chat` route does not receive the Dark V4 identity class.
- Experiment navigation stays inside the development route while using the existing Chat hooks.
- The production bundle does not register the experiment route.
- The experiment uses real server-authoritative messages and citations without new contracts.
- Assistant answer text remains inert and near-opaque; the default Chat source behavior is unchanged,
  while the experiment adds only message-local citation interaction.
- The existing focus semantics, reduced-motion rule, and three-field ambient implementation are
  preserved.
- No backend, schema, dependency, auth, CSRF, RAG, or Worker change exists; citation interaction is
  scoped to the development-only experiment route.

## Browser matrix result

- 1440 × 900: passed after the final material and receipt calibration.
- 1280 × 800, 1024 × 768, 390 × 844, empty, loading, error, insufficient-context,
  reduced-motion, no-backdrop-filter, and mobile navigation: pending fresh V4.1 browser evidence.
- No application error was observed in the available current capture.
- Message submission is covered by existing and updated automated Chat tests; no new AI message was
  sent during browser QA to avoid adding persistent user data or provider cost.
- The Composer was typed into and cleared to verify its enabled state without submitting data.
- No browser automation dependency was added to the repository.

## Summary for the decision owner

The isolated architecture is technically sound, the calibrated desktop capture is clean, and the
automated frontend checks pass. Complete the fresh responsive/state browser pass, then compare the
default and experimental routes to decide whether the direction merits a separate product-wide
exploration; this QA does not itself approve that rollout.
