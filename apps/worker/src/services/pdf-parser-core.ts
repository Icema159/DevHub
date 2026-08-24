import type { PdfProcessingLimits } from '../config/pdf-processing.js';
import { NonRetryableDocumentProcessingError } from './document-processing.error.js';
import { PdfContainmentError } from './pdf-containment.error.js';

export interface ExtractedPdfPage {
  pageNumber: number;
  text: string;
}

export interface ExtractedPdf {
  pageCount: number;
  pages: ExtractedPdfPage[];
}

interface ParsedTextPage {
  num: number;
  text: string;
}

interface ParsedTextResult {
  total: number;
  pages: ParsedTextPage[];
}

export interface PdfTextSource {
  getText(parameters: { partial: number[] }): Promise<ParsedTextResult>;
}

function pageFromResult(result: ParsedTextResult, pageNumber: number): ExtractedPdfPage {
  const page = result.pages.find((candidate) => candidate.num === pageNumber);

  if (!page) {
    throw new NonRetryableDocumentProcessingError(
      'PDF_EXTRACTION_FAILED',
      'The PDF text could not be extracted',
    );
  }

  return { pageNumber: page.num, text: page.text };
}

export async function extractPdfTextWithinLimits(
  source: PdfTextSource,
  limits: PdfProcessingLimits,
): Promise<ExtractedPdf> {
  const firstResult = await source.getText({ partial: [1] });
  const pageCount = firstResult.total;

  if (pageCount > limits.maxPages) {
    throw new PdfContainmentError(
      'PDF_PAGE_LIMIT_EXCEEDED',
      `The PDF exceeds the maximum supported page count of ${limits.maxPages}`,
    );
  }

  const pages: ExtractedPdfPage[] = [];
  let extractedCharacters = 0;
  let containsText = false;

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const result = pageNumber === 1 ? firstResult : await source.getText({ partial: [pageNumber] });
    const page = pageFromResult(result, pageNumber);
    extractedCharacters += page.text.length;

    if (extractedCharacters > limits.maxExtractedCharacters) {
      throw new PdfContainmentError(
        'PDF_TEXT_LIMIT_EXCEEDED',
        `The PDF exceeds the maximum supported extracted text size of ${limits.maxExtractedCharacters} characters`,
      );
    }

    containsText ||= page.text.trim().length > 0;
    pages.push(page);
  }

  if (!containsText) {
    throw new NonRetryableDocumentProcessingError(
      'PDF_TEXT_NOT_FOUND',
      'The PDF does not contain extractable text',
    );
  }

  return { pageCount, pages };
}
