import assert from 'node:assert/strict';
import test from 'node:test';

import { PDF_PROCESSING_LIMITS } from '../config/pdf-processing.js';
import { NonRetryableDocumentProcessingError } from './document-processing.error.js';
import { extractPdfTextWithinLimits, type PdfTextSource } from './pdf-parser-core.js';

test('rejects a PDF before full extraction when its reported page count exceeds the limit', async () => {
  let extractionCalls = 0;
  const source: PdfTextSource = {
    async getText() {
      extractionCalls += 1;
      return { total: 151, pages: [{ num: 1, text: 'First page' }] };
    },
  };

  await assert.rejects(
    () => extractPdfTextWithinLimits(source, PDF_PROCESSING_LIMITS),
    (error) =>
      error instanceof NonRetryableDocumentProcessingError &&
      error.code === 'PDF_PAGE_LIMIT_EXCEEDED',
  );
  assert.equal(extractionCalls, 1);
});

test('stops page-by-page extraction when the cumulative text limit is exceeded', async () => {
  const requestedPages: number[] = [];
  const source: PdfTextSource = {
    async getText({ partial }) {
      const pageNumber = partial[0] ?? 1;
      requestedPages.push(pageNumber);
      return {
        total: 3,
        pages: [{ num: pageNumber, text: '123456' }],
      };
    },
  };

  await assert.rejects(
    () =>
      extractPdfTextWithinLimits(source, {
        ...PDF_PROCESSING_LIMITS,
        maxExtractedCharacters: 10,
      }),
    (error) =>
      error instanceof NonRetryableDocumentProcessingError &&
      error.code === 'PDF_TEXT_LIMIT_EXCEEDED',
  );
  assert.deepEqual(requestedPages, [1, 2]);
});
