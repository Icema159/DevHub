# ADR-0001: Use a monorepo with npm workspaces

- Status: Accepted
- Date: 2026-07-16

## Context

Developer Knowledge Hub is one product made of closely related deployable applications and shared code:

- a React web application;
- an Express HTTP API;
- a Node.js background worker;
- shared TypeScript types and validation schemas.

These parts will evolve together. API contracts, job payloads, document-processing states, and validation schemas must remain consistent across application boundaries.

## Options considered

1. Use a monorepo managed with npm workspaces.
2. Use a polyrepo, with separate repositories for the frontend, API, worker, and shared packages.

## Decision

Use a monorepo with npm workspaces. The intended repository shape is:

```text
apps/
  web/
  api/
  worker/
packages/
  shared/
docs/
```

npm workspaces will provide package linking and shared dependency management without introducing an additional monorepo orchestration tool before one is needed.

## Consequences

- Cross-application contract changes can be reviewed and tested in one change.
- Shared types and schemas can be consumed without publishing them to an external registry.
- Tooling, scripts, and dependency versions can be kept consistent across the product.
- Local development and continuous integration can operate from one repository.
- The repository can become harder to navigate as it grows, and CI may eventually need change-aware execution or caching.
- Applications must still keep clear boundaries; sharing a repository does not justify coupling business logic across applications.
- Independent release permissions and completely separate release schedules are less natural than in a polyrepo.

## Review trigger

Revisit this decision if independent teams need separate access controls or release schedules, or if repository size makes builds and CI impractical despite targeted execution and caching.
