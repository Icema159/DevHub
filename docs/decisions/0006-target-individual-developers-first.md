# ADR-0006: Target individual developers first

- Status: Accepted
- Date: 2026-07-15

## Context

The broader product could serve individuals, freelancers, engineering teams, or companies. Designing the first version for all of them would immediately require organizations, invitations, team roles, shared billing, and more complicated authorization.

## Options considered

1. Build a personal knowledge hub for an individual developer.
2. Build a collaborative workspace for development teams from the start.
3. Build a generic document AI platform for any profession.

## Decision

The MVP will target an individual software developer organizing personal technical knowledge. The product language and data model should avoid unnecessary obstacles to future team support, but team behavior will not be implemented speculatively.

## Consequences

- The initial user journey is easier to explain and validate.
- Authorization can focus on strict user ownership before introducing team roles.
- Collaboration, invitations, shared workspaces, and billing are deferred.
- Product examples and evaluation documents can be specifically technical.

## Review trigger

Revisit this decision after the personal end-to-end document workflow is complete and there is evidence that collaboration is the most valuable next capability.
