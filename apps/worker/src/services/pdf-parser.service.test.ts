import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Worker } from 'node:worker_threads';

import { PDF_PROCESSING_LIMITS } from '../config/pdf-processing.js';
import { NonRetryableDocumentProcessingError } from './document-processing.error.js';
import { PdfParserService } from './pdf-parser.service.js';

const fixtureUrl = new URL('./fixtures/text-document.pdf', import.meta.url);

test('extracts ordered page text from a valid PDF', async () => {
  const service = new PdfParserService();
  const content = await readFile(fixtureUrl);

  const result = await service.extractText(content);

  assert.equal(result.pageCount, 1);
  assert.deepEqual(result.pages, [
    {
      pageNumber: 1,
      text: 'Developer Knowledge Hub Phase 8.3 PDF text extraction works.',
    },
  ]);
});

test('terminates a parser that exceeds its deadline without terminating the main worker', async () => {
  const service = new PdfParserService({
    limits: { ...PDF_PROCESSING_LIMITS, parserTimeoutMs: 25 },
    createWorker: () => new Worker('while (true) {}', { eval: true }),
  });

  await assert.rejects(
    () => service.extractText(Buffer.from('%PDF-timeout')),
    (error) =>
      error instanceof NonRetryableDocumentProcessingError &&
      error.code === 'PDF_PROCESSING_TIMEOUT',
  );

  const result = await new PdfParserService().extractText(await readFile(fixtureUrl));
  assert.equal(result.pageCount, 1);
});

test('contains an isolated parser crash and can process a subsequent valid PDF', async () => {
  const service = new PdfParserService({
    createWorker: () => new Worker("throw new Error('isolated parser crash')", { eval: true }),
  });

  await assert.rejects(
    () => service.extractText(Buffer.from('%PDF-crash')),
    (error) =>
      error instanceof NonRetryableDocumentProcessingError && error.code === 'PDF_PROCESSING_CRASH',
  );

  const result = await new PdfParserService().extractText(await readFile(fixtureUrl));
  assert.equal(result.pages[0]?.pageNumber, 1);
});

test('propagates the page limit from the isolated parser as a non-retryable error', async () => {
  const service = new PdfParserService({
    limits: { ...PDF_PROCESSING_LIMITS, maxPages: 0 },
  });

  await assert.rejects(
    async () => service.extractText(await readFile(fixtureUrl)),
    (error) =>
      error instanceof NonRetryableDocumentProcessingError &&
      error.code === 'PDF_PAGE_LIMIT_EXCEEDED',
  );
});

test('propagates the extracted text limit from the isolated parser as a non-retryable error', async () => {
  const service = new PdfParserService({
    limits: { ...PDF_PROCESSING_LIMITS, maxExtractedCharacters: 10 },
  });

  await assert.rejects(
    async () => service.extractText(await readFile(fixtureUrl)),
    (error) =>
      error instanceof NonRetryableDocumentProcessingError &&
      error.code === 'PDF_TEXT_LIMIT_EXCEEDED',
  );
});

test('reports malformed PDF content as a non-retryable extraction failure', async () => {
  const service = new PdfParserService();

  await assert.rejects(
    () => service.extractText(Buffer.from('%PDF-this-is-not-a-complete-document')),
    (error) =>
      error instanceof NonRetryableDocumentProcessingError &&
      error.code === 'PDF_EXTRACTION_FAILED',
  );
});
