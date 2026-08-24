import { parentPort, workerData } from 'node:worker_threads';

import { PDFParse } from 'pdf-parse';

import type { PdfProcessingLimits } from '../config/pdf-processing.js';
import { NonRetryableDocumentProcessingError } from './document-processing.error.js';
import {
  extractPdfTextWithinLimits,
  type ExtractedPdf,
  type PdfTextSource,
} from './pdf-parser-core.js';

interface PdfParserWorkerInput {
  content: Uint8Array;
  limits: PdfProcessingLimits;
}

export type PdfParserWorkerResponse =
  { type: 'success'; result: ExtractedPdf } | { type: 'error'; code: string; message: string };

function safeFailure(error: unknown): PdfParserWorkerResponse {
  if (error instanceof NonRetryableDocumentProcessingError) {
    return { type: 'error', code: error.code, message: error.message };
  }

  return {
    type: 'error',
    code: 'PDF_EXTRACTION_FAILED',
    message: 'The PDF text could not be extracted',
  };
}

async function run(): Promise<PdfParserWorkerResponse> {
  const input = workerData as PdfParserWorkerInput;
  const parser = new PDFParse({
    data: input.content,
    isEvalSupported: false,
    stopAtErrors: true,
  });
  let response: PdfParserWorkerResponse;

  try {
    response = {
      type: 'success',
      result: await extractPdfTextWithinLimits(parser as PdfTextSource, input.limits),
    };
  } catch (error) {
    response = safeFailure(error);
  }

  try {
    await parser.destroy();
  } catch {
    response = {
      type: 'error',
      code: 'PDF_EXTRACTION_FAILED',
      message: 'The PDF text could not be extracted',
    };
  }

  return response;
}

if (!parentPort) {
  throw new Error('PDF parser worker requires a parent port');
}

parentPort.postMessage(await run());
