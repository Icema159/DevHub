import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { Worker, type WorkerOptions } from 'node:worker_threads';

import { PDF_PROCESSING_LIMITS, type PdfProcessingLimits } from '../config/pdf-processing.js';
import { NonRetryableDocumentProcessingError } from './document-processing.error.js';
import { PdfContainmentError } from './pdf-containment.error.js';
import type { ExtractedPdf } from './pdf-parser-core.js';
import type { PdfParserWorkerResponse } from './pdf-parser.worker.js';

export type { ExtractedPdf, ExtractedPdfPage } from './pdf-parser-core.js';

export interface PdfParser {
  extractText(content: Buffer): Promise<ExtractedPdf>;
}

interface ParserWorker {
  once(event: 'message', listener: (response: PdfParserWorkerResponse) => void): this;
  once(event: 'error', listener: (error: Error) => void): this;
  once(event: 'exit', listener: (exitCode: number) => void): this;
  removeAllListeners(): this;
  terminate(): Promise<number>;
}

type ParserWorkerFactory = (filename: URL, options: WorkerOptions) => ParserWorker;

export interface PdfParserServiceOptions {
  limits?: PdfProcessingLimits;
  createWorker?: ParserWorkerFactory;
}

function createParserWorker(filename: URL, options: WorkerOptions): ParserWorker {
  if (!filename.pathname.endsWith('.ts')) {
    return new Worker(filename, options);
  }

  const require = createRequire(import.meta.url);
  const tsxApiUrl = pathToFileURL(require.resolve('tsx/esm/api')).href;
  const bootstrap = [
    `import { register } from ${JSON.stringify(tsxApiUrl)};`,
    'register();',
    `await import(${JSON.stringify(filename.href)});`,
  ].join('\n');

  return new Worker(new URL(`data:text/javascript,${encodeURIComponent(bootstrap)}`), options);
}

function isParserWorkerResponse(value: unknown): value is PdfParserWorkerResponse {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    return false;
  }

  if (value.type === 'success') {
    return 'result' in value;
  }

  return value.type === 'error' && 'code' in value && 'message' in value;
}

export class PdfParserService implements PdfParser {
  private readonly limits: PdfProcessingLimits;
  private readonly createWorker: ParserWorkerFactory;

  constructor(options: PdfParserServiceOptions = {}) {
    this.limits = options.limits ?? PDF_PROCESSING_LIMITS;
    this.createWorker = options.createWorker ?? createParserWorker;
  }

  async extractText(content: Buffer): Promise<ExtractedPdf> {
    const parserInput = Uint8Array.from(content);
    let worker: ParserWorker;

    try {
      worker = this.createWorker(new URL('./pdf-parser.worker.ts', import.meta.url), {
        workerData: {
          content: parserInput,
          limits: this.limits,
        },
        transferList: [parserInput.buffer],
        resourceLimits: {
          maxOldGenerationSizeMb: this.limits.parserMaxOldGenerationSizeMb,
          maxYoungGenerationSizeMb: this.limits.parserMaxYoungGenerationSizeMb,
          stackSizeMb: this.limits.parserStackSizeMb,
        },
      });
    } catch (error) {
      throw new PdfContainmentError(
        'PDF_PROCESSING_CRASH',
        'The PDF could not be processed safely',
        { cause: error },
      );
    }

    return new Promise<ExtractedPdf>((resolve, reject) => {
      let settled = false;

      const finish = (callback: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        worker.removeAllListeners();
        callback();
      };

      const timeout = setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        worker.removeAllListeners();

        void worker.terminate().finally(() => {
          reject(
            new PdfContainmentError('PDF_PROCESSING_TIMEOUT', 'The PDF took too long to process'),
          );
        });
      }, this.limits.parserTimeoutMs);

      worker.once('message', (response) => {
        finish(() => {
          if (!isParserWorkerResponse(response)) {
            reject(
              new PdfContainmentError(
                'PDF_PROCESSING_CRASH',
                'The PDF could not be processed safely',
              ),
            );
            return;
          }

          if (response.type === 'success') {
            resolve(response.result);
            return;
          }

          reject(new NonRetryableDocumentProcessingError(response.code, response.message));
        });
      });

      worker.once('error', (error) => {
        finish(() => {
          reject(
            new PdfContainmentError(
              'PDF_PROCESSING_CRASH',
              'The PDF could not be processed safely',
              { cause: error },
            ),
          );
        });
      });

      worker.once('exit', () => {
        finish(() => {
          reject(
            new PdfContainmentError(
              'PDF_PROCESSING_CRASH',
              'The PDF could not be processed safely',
            ),
          );
        });
      });
    });
  }
}

export const pdfParser = new PdfParserService();
