# UI redesign orchestration

This directory is the shared, documentation-only control plane for UI work between Claude
(Design Director), Codex (Implementation Engineer), and the human product owner.

The current production application remains the source of truth. Creating or editing artifacts in
this directory does not authorize application-code changes. Implementation begins only after the
human records an explicit approval in the task decision file.

## Start here

1. Read `docs/design-manifesto.md`, `docs/roadmap.md`, and the relevant production UI before making
   a proposal.
2. Read [the collaboration protocol](protocol.md), [the roles](roles.md), and
   [the decision workflow](decision-workflow.md).
3. Work only in the active task folder under `tasks/` unless the task explicitly expands scope.
4. Use the files in `templates/` when opening a new task or review round.

## Directory contract

```text
docs/ui-redesign/
  README.md
  protocol.md
  roles.md
  decision-workflow.md
  templates/
    task-template.md
    review-template.md
  tasks/
    UR-001-liquid-glass-foundation/
      README.md
      task.md
      design-proposal.md
      feasibility-review.md
      cross-review.md
      decision.md
      implementation-experiment.md
      visual-qa.md
      technical-qa.md
```

`UR-001` began as a planning and assessment task; on its own it did not authorize a product-wide redesign or any production-code edit. The human product owner subsequently recorded that approval (see `tasks/UR-001-liquid-glass-foundation/decision.md`), and the dark V4 "Liquid Glass" identity it evaluated has since been implemented and shipped to production across Auth and every authenticated page -- UR-001's status is PROMOTED / COMPLETED / SUPERSEDED BY PRODUCTION V4. Its files remain as a historical record of that evaluation and are not rewritten to read as if implementation followed immediately; see `tasks/UR-001-liquid-glass-foundation/README.md` for the current-status note.
