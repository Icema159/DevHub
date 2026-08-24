export interface PdfProcessingLimits {
  maxPages: number;
  maxExtractedCharacters: number;
  maxChunks: number;
  parserTimeoutMs: number;
  parserMaxOldGenerationSizeMb: number;
  parserMaxYoungGenerationSizeMb: number;
  parserStackSizeMb: number;
}

export const PDF_PROCESSING_LIMITS = Object.freeze({
  maxPages: 150,
  maxExtractedCharacters: 1_000_000,
  maxChunks: 1_000,
  parserTimeoutMs: 30_000,
  parserMaxOldGenerationSizeMb: 256,
  parserMaxYoungGenerationSizeMb: 32,
  parserStackSizeMb: 4,
} satisfies PdfProcessingLimits);
