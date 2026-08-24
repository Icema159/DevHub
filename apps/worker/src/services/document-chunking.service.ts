import { PDF_PROCESSING_LIMITS } from '../config/pdf-processing.js';
import { PdfContainmentError } from './pdf-containment.error.js';
import type { ExtractedPdfPage } from './pdf-parser.service.js';

export const DEFAULT_MAX_CHUNK_CHARACTERS = 1200;
export const TOKEN_COUNT_METHOD = 'character-estimate-v1';

export interface DocumentChunkDraft {
  position: number;
  content: string;
  tokenCount: number;
  metadata: {
    pageNumber: number;
    characterCount: number;
    tokenCountMethod: typeof TOKEN_COUNT_METHOD;
  };
}

export interface DocumentChunker {
  chunkPages(pages: ExtractedPdfPage[]): DocumentChunkDraft[];
}

function normalizeText(text: string): string {
  return text.replaceAll('\u0000', '').replace(/\s+/g, ' ').trim();
}

function findSplitPosition(text: string, maxCharacters: number): number {
  const whitespacePosition = text.lastIndexOf(' ', maxCharacters);
  const minimumUsefulSplit = Math.floor(maxCharacters * 0.6);

  return whitespacePosition >= minimumUsefulSplit ? whitespacePosition : maxCharacters;
}

function splitPageText(text: string, maxCharacters: number): string[] {
  const chunks: string[] = [];
  let remaining = normalizeText(text);

  while (remaining.length > maxCharacters) {
    const splitPosition = findSplitPosition(remaining, maxCharacters);
    const chunk = remaining.slice(0, splitPosition).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    remaining = remaining.slice(splitPosition).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

function estimateTokenCount(content: string): number {
  return Math.max(1, Math.ceil(content.length / 4));
}

export class DocumentChunkingService implements DocumentChunker {
  constructor(
    private readonly maxCharacters = DEFAULT_MAX_CHUNK_CHARACTERS,
    private readonly maxChunks = PDF_PROCESSING_LIMITS.maxChunks,
  ) {
    if (!Number.isInteger(maxCharacters) || maxCharacters <= 0) {
      throw new Error('maxCharacters must be a positive integer');
    }

    if (!Number.isInteger(maxChunks) || maxChunks <= 0) {
      throw new Error('maxChunks must be a positive integer');
    }
  }

  chunkPages(pages: ExtractedPdfPage[]): DocumentChunkDraft[] {
    const chunks: DocumentChunkDraft[] = [];

    for (const page of pages) {
      for (const content of splitPageText(page.text, this.maxCharacters)) {
        if (chunks.length >= this.maxChunks) {
          throw new PdfContainmentError(
            'PDF_CHUNK_LIMIT_EXCEEDED',
            `The PDF exceeds the maximum of ${this.maxChunks} document chunks`,
          );
        }

        chunks.push({
          position: chunks.length,
          content,
          tokenCount: estimateTokenCount(content),
          metadata: {
            pageNumber: page.pageNumber,
            characterCount: content.length,
            tokenCountMethod: TOKEN_COUNT_METHOD,
          },
        });
      }
    }

    return chunks;
  }
}

export const documentChunker = new DocumentChunkingService();
