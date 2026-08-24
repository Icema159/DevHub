# ADR-0007: Use pdf-parse behind a worker parser abstraction

- Status: Accepted
- Date: 2026-07-18
- Amended: 2026-08-22 (Phase 13B.5.2 containment boundary)

## Context

The background worker must convert uploaded PDFs into ordered plain text before the application can create searchable chunks. PDF is a structured binary format with fonts, streams, page resources, and text positioning; checking the `%PDF` signature is not sufficient to extract or validate its contents.

The initial product needs text extraction from digitally generated PDFs. OCR, layout reconstruction, tables, and image extraction are outside the current phase.

## Options considered

1. Use `pdf-parse`, which provides a typed text-focused API over PDF.js.
2. Use `pdfjs-dist` directly and assemble page text from lower-level PDF.js structures.
3. Invoke an operating-system tool such as `pdftotext` from the worker.
4. Send documents to a managed extraction or OCR service.

## Decision

Use `pdf-parse` as the initial PDF text extraction implementation. Keep it behind a worker-owned `PdfParser` interface so document-processing business logic depends on an application result containing ordered pages, not on library-specific types.

Parsing runs only in a dedicated Node Worker Thread owned by the background worker. The thread has
bounded memory resources, is forcibly terminated after 30 seconds, and extracts text page by page
under centralized page and character limits. Deterministic parsing and containment failures, and
PDFs without extractable text, are treated as non-retryable; the document is marked `FAILED` with a
safe message. The parser is configured to stop on structural errors and disables evaluated PDF
functions.

## Consequences

- The initial implementation has a small, typed API and preserves page order and page numbers.
- Parser-specific behavior is isolated and can be replaced without changing queue or persistence contracts.
- A parser timeout or crash cannot block the main BullMQ event loop or terminate the other queue
  consumers, and rejected files cannot reach chunk persistence or embedding work.
- `pdf-parse` brings PDF.js and native canvas-related transitive dependencies into the worker package.
- Direct PDF.js usage would offer more layout control but require more text-item assembly code.
- A system CLI would reduce JavaScript parsing code but add an external runtime dependency and process-management concerns.
- Image-only PDFs remain unsupported until OCR is justified and designed.
- Extracted plain text does not preserve every visual relationship in complex layouts, tables, or multi-column documents.

## Review trigger

Revisit this decision when evaluation documents show unacceptable extraction quality, OCR becomes
a product requirement, page layout is required for citations, or the public threat model justifies
an operating-system process/container sandbox, malware scanning, or content disarm and
reconstruction beyond Worker Thread containment.
