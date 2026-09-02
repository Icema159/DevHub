# Decision workflow

## End-to-end flow

```text
Human/orchestrator defines a bounded task
  -> Claude design proposal || Codex current-state feasibility assessment
  -> Claude reviews feasibility findings
  -> Codex reviews the reconciled design response
  -> orchestrator records options, disagreements, and recommendation
  -> human APPROVE / REVISE / REJECT
  -> Codex implements only the approved scope
  -> Claude visual QA || Codex technical QA
  -> corrections return through the same recorded decision boundary
  -> human final approval
  -> commit / push / merge only when explicitly authorized
```

Parallel work is limited to independent analysis or QA against the same immutable task revision.
Stages that consume another artifact begin only after that artifact is marked `READY_FOR_REVIEW`.

## Gate 0 — Task readiness

The orchestrator confirms the task has a problem statement, evidence, in/out scope, constraints,
deliverables, acceptance criteria, and named artifacts. Ambiguous product-wide redesign requests
must be reduced to one reviewable objective before specialist work begins.

## Gate 1 — Proposal and feasibility

Claude writes `design-proposal.md`. Codex writes `feasibility-review.md`. For truly parallel first
passes, Codex assesses current production constraints without pretending to review an unfinished
proposal. Once both are ready, each reads the other's artifact.

## Gate 2 — Cross-review and reconciliation

`cross-review.md` records each issue using an ID. Every blocking issue ends in one of four states:

- `ACCEPTED` — proposal changes as requested;
- `ALTERNATIVE_ACCEPTED` — both support a recorded alternative;
- `OPEN_FOR_HUMAN` — specialists disagree or the trade-off is product-owned;
- `WITHDRAWN` — the reviewer retracts the concern with a reason.

No issue disappears through an untracked rewrite.

## Gate 3 — Human implementation approval

The orchestrator summarizes the reconciled proposal in `decision.md`. The human records the status,
approved artifact revisions, exact implementation scope, exclusions, and conditions. `APPROVED`
authorizes implementation only; it does not authorize commits, pushes, merges, deployments, or a
broader redesign.

## Gate 4 — Implementation and dual QA

Codex implements in a dedicated branch or worktree if the human workflow requires one. Claude checks
visual fidelity, hierarchy, responsive states, accessibility intent, and the approved exclusions in
`visual-qa.md`. Codex checks contracts, tests, safe rendering, accessibility mechanics, responsive
behavior, regressions, and diff scope in `technical-qa.md`.

A QA correction outside the approved decision returns to Gate 2 or Gate 3. Neither agent may expand
scope under the label of polish.

## Gate 5 — Human final approval

The human chooses `ACCEPT`, `REVISE`, or `REJECT`. Only an explicit follow-up instruction may commit,
push, open a pull request, merge, or deploy the result.
