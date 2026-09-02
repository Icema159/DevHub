# Claude–Codex collaboration protocol

## Purpose

Use two specialist perspectives without letting parallel work create conflicting implementation or
silently expand scope. Claude leads visual and interaction design. Codex leads implementation
feasibility and engineering quality. The human product owner owns scope, approvals, and final
trade-offs.

## Source-of-truth order

Before acting, both agents must inspect current sources rather than rely on an earlier chat summary:

1. production behavior, code, and tests;
2. `AGENTS.md` and repository-specific instructions;
3. `docs/product-scope.md`, `docs/roadmap.md`, `docs/design-manifesto.md`, architecture, API, and
   security documentation;
4. the active task's approved `decision.md`;
5. proposals and reviews in the active task folder;
6. prompts and conversation summaries.

If two sources conflict, stop at the earliest safe point, record the conflict, and ask the human to
resolve it. Do not make production behavior match a lower-priority document automatically.

## Shared operating rules

- One task folder represents one bounded learning objective and one approval chain.
- Each artifact names its author role, status, evidence, assumptions, open questions, and files or
  routes in scope.
- Parallel analysis is encouraged; parallel edits to application code are not.
- During proposal and review stages, both agents may edit only their assigned documentation artifact.
- Neither agent may rewrite the other agent's authored section. Responses go into the designated
  cross-review or a new review round.
- Claims about current behavior must point to inspected code, documentation, screenshots, tests, or
  browser evidence. Mark inference explicitly.
- A disagreement must state the risk, evidence, proposed alternative, and acceptance condition.
- Silence is not approval. Only a recorded human decision advances an approval gate.
- Any material scope change returns the task to proposal/review; it does not ride along with an
  approved implementation.
- Preserve safe text rendering, backend-authoritative state, owner scope, accessibility, responsive
  behavior, reduced motion, and no-backdrop-filter fallbacks.
- Do not commit, push, merge, install dependencies, change infrastructure, or contact external
  services unless the human explicitly authorizes that action.

## File ownership by stage

| Stage                | Primary writer              | Shared read access | Production edits                   |
| -------------------- | --------------------------- | ------------------ | ---------------------------------- |
| Task definition      | Human/orchestrator          | Claude + Codex     | Forbidden                          |
| Design proposal      | Claude                      | Codex              | Forbidden                          |
| Feasibility review   | Codex                       | Claude             | Forbidden                          |
| Cross-review         | Claude, then Codex response | Both               | Forbidden                          |
| Decision             | Human/orchestrator          | Both               | Forbidden                          |
| Implementation       | Codex                       | Claude             | Only explicitly approved files     |
| Visual QA            | Claude                      | Codex              | Review only                        |
| Technical QA         | Codex                       | Claude             | Approved corrections only          |
| Final approval/merge | Human                       | Both               | Only explicitly authorized actions |

## Status vocabulary

- `DRAFT` — incomplete and not ready for review.
- `READY_FOR_REVIEW` — author considers the artifact complete.
- `CHANGES_REQUESTED` — reviewer found blocking issues.
- `PROPOSED` — reconciled solution awaiting a human decision.
- `APPROVED` — human authorizes only the recorded next stage and scope.
- `REJECTED` — proposal will not proceed.
- `SUPERSEDED` — replaced by a later named artifact or decision.
- `VERIFIED` — approved outcome passed its recorded checks.

## Completion rule

A task is complete only when the decision and both applicable QA artifacts agree on the delivered
scope, the human records final approval, and any remaining risks or deferred work are explicit.
