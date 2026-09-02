# Product scope

## One-sentence definition

Developer Knowledge Hub is a SaaS web application that helps developers organize technical documents and find reliable information in them through conventional search and AI-assisted questions with source references.

This scope describes the implementation inspected on 2026-08-26. The main Railway demo path is
operator-confirmed working; see [technical-documentation.md](technical-documentation.md) for
the evidence boundary and deployment limitations.

## Target user

### Primary user for the MVP

An individual software developer who regularly collects technical material from personal projects, work, courses, and research.

The developer's source material may include:

- `README.md` and other Markdown files;
- technical PDFs;
- architecture and API documentation;
- plain-text notes;
- code or configuration examples;
- learning material.

The current ingestion contract accepts PDF only. Mentioning Markdown or notes here describes the
user's knowledge sources, not additional supported upload formats or a built-in editor.

### Possible later users

- freelancers managing knowledge across client projects;
- students and junior developers;
- startup engineering teams;
- companies maintaining internal technical knowledge.

These users do not determine the first MVP design.

### Current organization model

The schema models one private personal document library per user: each document belongs directly to its owner. First-class projects, folders, and collections are deferred until their behavior and value are designed explicitly. Flexible `Document.metadata` can hold tags; no tag-management UI or tag-filter contract is currently implemented.

## User problem

Technical knowledge is fragmented across repositories, cloud drives, note applications, chat tools, local folders, and browser bookmarks. Filename search and `Ctrl + F` only work when the user remembers where the information is and which exact words it contains.

This creates four concrete problems:

1. **Fragmentation** — related information lives in different systems.
2. **Poor rediscovery** — previously solved problems are difficult to find later.
3. **Context switching** — the developer must search several tools separately.
4. **Low trust in AI answers** — a generic AI answer may not reflect the user's actual documentation and often lacks source references.

## Product value

The platform creates one private library and lets the user ask questions across all of their non-deleted READY documents. Answers identify the retrieved sources used. Source cards currently open Document Details, not the original PDF; original-file viewing/download is a future verification improvement.

## Core user journey

1. The user creates an account, signs in, and verifies their email before upload or AI work.
2. The user opens their private personal document library.
3. The user uploads a PDF within the configured size and owner quotas.
4. The platform stores the original file and shows its processing status.
5. A background process extracts and indexes its text.
6. The user browses or searches the document library.
7. The user asks a question across their READY library, optionally following up in the same conversation.
8. The platform retrieves relevant passages and produces a referenced answer.
9. The user reads source references and opens the cited document's metadata. Original-PDF access is not available yet.

## MVP capabilities

Implemented MVP capabilities:

- account registration, revocable cookie sessions, sign-out, email verification, and protected user data;
- one private personal document library per user, with documents owned directly by the account;
- validated PDF-only upload with duplicate detection and resource limits;
- document metadata and processing states;
- asynchronous text extraction and indexing;
- document library with filename search, grouped status filters, pagination, and details;
- owner-scoped semantic retrieval across non-deleted READY documents;
- AI question answering grounded in retrieved passages;
- persisted conversations, bounded current-conversation context, and source references attached to answers;
- document deletion, including stored file and indexed content cleanup;
- Failed-only manual processing restart;
- session/CSRF/Origin protections, PDF containment, quotas, AI budget admission, health checks, and regression tests.

## Current format and retrieval decisions

PDF with an extractable text layer is the supported input. The default upload ceiling is 10 MiB,
with independent Worker page/text/chunk/time limits. Image-only PDFs have no OCR fallback.
Markdown, DOCX, and other formats remain future work. Filename search is distinct from semantic
content retrieval: a general extracted-content keyword search UI is not implemented.

Chat searches the owner's READY library, not a client-selected document subset. Recent context
helps resolve follow-ups but is not long-term memory or factual evidence. Answers remain grounded
in newly retrieved authorized chunks.

## Non-goals for the MVP

- real-time multi-user document editing;
- team roles and complex organization permissions;
- subscriptions and real payment processing;
- mobile applications;
- importing whole GitHub repositories;
- integrations with Slack, Notion, Google Drive, or Confluence;
- training or fine-tuning a custom language model;
- autonomous code modification;
- replacing a general-purpose cloud drive;
- supporting every document format from the start.

## Product principles

1. **Sources before generated text** — the user must be able to verify an AI answer.
2. **Clear processing state** — uploads must never disappear into an unexplained background process.
3. **Private by default** — one user's documents must never be accessible to another user.
4. **Useful without AI** — document organization and conventional search should have value on their own.
5. **Progressive complexity** — retain the existing working pipeline and add infrastructure only for a demonstrated product or operational need.

## Initial success criteria

The MVP is successful when a developer can:

- upload a supported technical document;
- see whether processing succeeded or failed;
- find it later by filename or retrieve relevant content through semantic questions;
- ask a question whose answer is based on that document;
- see which sources support an answer and inspect their document metadata;
- delete the document without leaving user-visible or indexed data behind.

## Remaining product questions

The MVP targets personal workspaces, as recorded in ADR-0006. The following remain product choices,
not current capabilities:

1. Which additional document format, if any, justifies a second ingestion path?
2. Should users write notes inside the platform in the MVP, or only upload files?
3. Should the existing library-wide retrieval gain explicit source selection or metadata filters?
4. When should original-PDF viewing/download be added for stronger source verification?
5. Should the currently English interface support additional product languages?
