# Product scope

## One-sentence definition

Developer Knowledge Hub is a SaaS web application that helps developers organize technical documents and find reliable information in them through conventional search and AI-assisted questions with source references.

## Target user

### Primary user for the MVP

An individual software developer who regularly collects technical material from personal projects, work, courses, and research.

Typical material includes:

- `README.md` and other Markdown files;
- technical PDFs;
- architecture and API documentation;
- plain-text notes;
- code or configuration examples;
- learning material.

### Possible later users

- freelancers managing knowledge across client projects;
- students and junior developers;
- startup engineering teams;
- companies maintaining internal technical knowledge.

These users do not determine the first MVP design.

### Current organization model

The initial schema models one private personal document library per user: each document belongs directly to its owner. First-class projects, folders, and collections are deferred until their behavior and value are designed explicitly. Lightweight organization such as tags remains inside flexible `Document.metadata` rather than a separate table or field.

## User problem

Technical knowledge is fragmented across repositories, cloud drives, note applications, chat tools, local folders, and browser bookmarks. Filename search and `Ctrl + F` only work when the user remembers where the information is and which exact words it contains.

This creates four concrete problems:

1. **Fragmentation** — related information lives in different systems.
2. **Poor rediscovery** — previously solved problems are difficult to find later.
3. **Context switching** — the developer must search several tools separately.
4. **Low trust in AI answers** — a generic AI answer may not reflect the user's actual documentation and often lacks source references.

## Product value

The platform creates one searchable knowledge library and lets the user ask questions against selected, privately stored sources. Answers should identify which documents support them, so the user can verify the result instead of trusting generated text blindly.

## Core user journey

1. The user creates an account and signs in.
2. The user opens their private personal document library.
3. The user uploads a supported document.
4. The platform stores the original file and shows its processing status.
5. A background process extracts and indexes its text.
6. The user browses or searches the document library.
7. The user asks a question about one or more selected sources.
8. The platform retrieves relevant passages and produces a referenced answer.
9. The user opens the source to verify the answer.

## MVP capabilities

The exact implementation will be decided phase by phase. The intended MVP contains:

- account registration, sign-in, sign-out, and protected user data;
- one private personal document library per user, with documents owned directly by the account;
- flexible document metadata, including tags, for lightweight organization;
- upload of a deliberately small set of document formats;
- document metadata and processing states;
- asynchronous text extraction and indexing;
- document library with filtering and basic keyword search;
- semantic retrieval across selected documents;
- AI question answering grounded in retrieved passages;
- source references attached to answers;
- document deletion, including stored file and indexed content cleanup;
- consistent error handling, logs, health checks, and essential tests.

## MVP format decision still open

We will choose the first supported formats before implementing uploads. The leading option is to begin with PDF and Markdown only, prove the complete processing pipeline, and add DOCX or other formats afterward.

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
5. **Progressive complexity** — start with a simple working flow, then add queues, semantic search, caching, and other infrastructure only when needed.

## Initial success criteria

The MVP is successful when a developer can:

- upload a supported technical document;
- see whether processing succeeded or failed;
- find it later by metadata or content;
- ask a question whose answer is based on that document;
- open the cited source and verify the answer;
- delete the document without leaving user-visible or indexed data behind.

## Remaining product questions

The MVP targets personal workspaces while avoiding unnecessary barriers to future team support, as recorded in ADR-0006. The remaining questions are:

1. Which two document formats provide the best first complete workflow?
2. Should users write notes inside the platform in the MVP, or only upload files?
3. Should an AI question search the whole personal library by default or require selected documents or metadata filters?
4. Is the initial product language English only?
