# ADR-0002: Use an object storage abstraction with Cloudflare R2

- Status: Accepted
- Date: 2026-07-16

## Context

The product must retain original uploaded documents while PostgreSQL stores their ownership, metadata, processing state, and derived records. Uploaded files may be much larger than ordinary relational rows and have different access, retention, and transfer requirements.

Storing file bytes in PostgreSQL would increase database size, backup and restore time, replication traffic, and pressure on database connections. It would also couple large-file transfer to the transactional database even though relational queries do not need the file contents.

## Options considered

1. Store original files through an object storage abstraction, initially backed by Cloudflare R2.
2. Use AWS S3 directly throughout the application.
3. Store file bytes in PostgreSQL.
4. Store files on the API server's local filesystem.

## Decision

Use an application-owned object storage interface with Cloudflare R2 as the initial provider. PostgreSQL will store metadata and an opaque object key, not public provider URLs or file bytes.

Object storage is responsible for original file bytes, controlled reads, and deletion. The API and worker will depend on the interface rather than Cloudflare-specific client types.

## Consequences

- PostgreSQL remains focused on relational and transactional data.
- Large files can be transferred and retained using storage designed for objects.
- Original files can remain private and be accessed through controlled application flows.
- File deletion must be coordinated with metadata, chunks, embeddings, and other derived records.
- Upload success and metadata persistence can fail independently, so cleanup and retry behavior must be designed explicitly.
- The abstraction adds a small amount of interface and adapter code.
- AWS S3 remains a viable alternative. Migration is possible by adding another adapter and moving objects while preserving stable application-level object keys.
- Local filesystem storage may still be used by a development adapter, but it is not the production source of truth.

## Review trigger

Revisit the initial provider if operational requirements, regional availability, compliance, pricing, or integration needs favor another object storage service.
