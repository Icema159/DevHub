# ADR-0003: Use PostgreSQL with Prisma ORM

- Status: Accepted
- Date: 2026-07-16

## Context

Developer Knowledge Hub has strongly related data: users, workspaces, projects, documents, processing jobs, extracted chunks, conversations, messages, and source references. Ownership and deletion rules must remain consistent across these relationships.

The application also needs a database access layer that supports schema evolution, safe queries, and shared understanding of the data model across the API and worker.

## Options considered

1. Use PostgreSQL with Prisma ORM.
2. Use PostgreSQL through raw SQL and a database driver.
3. Use another TypeScript ORM or query builder.
4. Use a document database as the primary store.

## Decision

Use PostgreSQL as the relational source of truth and Prisma as the primary ORM and migration tool.

PostgreSQL fits the ownership model because it provides transactions, foreign keys, constraints, indexes, and mature relational querying. Prisma was selected for its declarative schema, generated TypeScript client, migration workflow, and readable data access for a learning-focused TypeScript project.

Database access will remain behind persistence-layer modules. Prisma types will not replace application-domain contracts at HTTP or job boundaries.

## Consequences

- Relationships and ownership constraints can be enforced in both application logic and the database.
- API and worker code receive typed database operations and a shared schema.
- Schema changes can be reviewed as migrations.
- Prisma adds generated code, its own schema language, and an abstraction that developers must understand.
- Advanced PostgreSQL features or performance-sensitive queries may not map cleanly to Prisma. Narrowly scoped raw SQL is acceptable when justified, reviewed, parameterized, and kept inside the persistence layer.
- Raw SQL would provide maximum database control with fewer abstractions, but would require more manual mapping, migration discipline, and type maintenance.
- Other ORMs or query builders may offer more SQL control, but Prisma provides the preferred balance of type safety, migrations, and approachability for the current phase.

## Review trigger

Revisit the ORM choice if Prisma blocks essential PostgreSQL capabilities, creates unacceptable query behavior, or makes pgvector integration impractical after a measured implementation attempt.
