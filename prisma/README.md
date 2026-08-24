# Prisma

`schema.prisma` contains the validated initial PostgreSQL data model for users, documents, chunks, conversations, messages, and refresh tokens. Migration `20260717213933_init` creates the initial database structure and enables the pgvector extension.

The migration is applied to the local Docker PostgreSQL database, and Prisma Client is generated into `generated/prisma`. The optional document-chunk embedding column uses the pgvector `vector` type without fixed dimensions or a similarity index; those decisions remain future work.
