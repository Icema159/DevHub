# UR-001 task workspace

This folder contains the shared record for the Liquid Glass redesign foundation assessment.

> **Final status: PROMOTED / COMPLETED / SUPERSEDED BY PRODUCTION V4.** The dark V4 identity evaluated by this task was subsequently approved and shipped to production across Auth and every authenticated page. The "Current stage" note and every artifact below are left unmodified as the historical record of this assessment as it happened -- they describe the state of the evaluation at the time, not the current state of the product. For the current product state, see the root `README.md`'s "Current UI (V4)" section and `docs/architecture.md`.

## Current stage

`V4.1_IMPLEMENTED_PENDING_HUMAN_REVIEW` — the isolated Chat-only Dark V4.1 evaluation route is
implemented, the current production Chat remains the default, and the automated frontend checks
pass. The final responsive browser matrix still requires a fresh browser run before visual sign-off;
no product-wide rollout, commit, push, merge, or deployment is authorized.

## Working order

1. Claude and Codex read `task.md` and the repository source-of-truth documents.
2. Claude writes `design-proposal.md`; Codex independently writes `feasibility-review.md`.
3. Both mark their artifact `READY_FOR_REVIEW` before cross-review begins.
4. Claude and Codex record reconciliations in `cross-review.md`.
5. The orchestrator prepares `decision.md`; the human decides whether any implementation task exists.
6. `visual-qa.md` and `technical-qa.md` remain inactive unless implementation is explicitly approved.
