export type AiCostOperation =
  'QUESTION_EMBEDDING' | 'ANSWER_GENERATION' | 'TITLE_GENERATION' | 'DOCUMENT_EMBEDDING';

export interface AiTokenUsage {
  inputTokens: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AiModelPricing {
  inputUsdPerMillionTokens: number;
  cachedInputUsdPerMillionTokens?: number;
  outputUsdPerMillionTokens?: number;
}

// Prices are centralized and deliberately keyed by exact provider model IDs.
// They are estimates for application-side safety controls, not invoice reconciliation.
const OPENAI_PRICING = Object.freeze<Record<string, AiModelPricing>>({
  'text-embedding-3-small': {
    inputUsdPerMillionTokens: 0.02,
  },
  'gpt-5.6-sol': {
    inputUsdPerMillionTokens: 5,
    cachedInputUsdPerMillionTokens: 0.5,
    outputUsdPerMillionTokens: 30,
  },
});

export class UnknownAiModelPricingError extends Error {
  constructor(provider: string, model: string) {
    super(`No cost policy is configured for ${provider}/${model}`);
    this.name = 'UnknownAiModelPricingError';
  }
}

function pricingFor(provider: string, model: string): AiModelPricing {
  if (provider !== 'openai') {
    throw new UnknownAiModelPricingError(provider, model);
  }

  const pricing = OPENAI_PRICING[model];

  if (!pricing) {
    throw new UnknownAiModelPricingError(provider, model);
  }

  return pricing;
}

function positiveInteger(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('AI token usage must be a non-negative finite number');
  }

  return Math.ceil(value);
}

function microUsd(tokens: number, usdPerMillionTokens: number): bigint {
  if (tokens === 0) {
    return 0n;
  }

  // USD / 1M tokens multiplied by 1M micro-USD / USD simplifies to
  // micro-USD per token. Round upward so enforcement never under-reserves.
  return BigInt(Math.max(1, Math.ceil(tokens * usdPerMillionTokens)));
}

export function estimateTokenUpperBound(text: string): number {
  // One token per UTF-8 byte is intentionally conservative for admission.
  return Math.max(1, Buffer.byteLength(text, 'utf8'));
}

export function estimateEmbeddingReservationMicroUsd(
  provider: string,
  model: string,
  texts: string[],
): bigint {
  const pricing = pricingFor(provider, model);
  const inputTokens = texts.reduce((total, text) => total + estimateTokenUpperBound(text), 0);

  return microUsd(inputTokens, pricing.inputUsdPerMillionTokens);
}

export function estimateChatReservationMicroUsd(
  provider: string,
  model: string,
  serializedInput: string,
  maxOutputTokens: number,
): bigint {
  const pricing = pricingFor(provider, model);

  if (pricing.outputUsdPerMillionTokens === undefined) {
    throw new UnknownAiModelPricingError(provider, model);
  }

  const inputTokens = estimateTokenUpperBound(serializedInput) + 256;

  return (
    microUsd(inputTokens, pricing.inputUsdPerMillionTokens) +
    microUsd(positiveInteger(maxOutputTokens), pricing.outputUsdPerMillionTokens)
  );
}

export function estimateUsageMicroUsd(
  provider: string,
  model: string,
  usage: AiTokenUsage,
): bigint {
  const pricing = pricingFor(provider, model);
  const cachedInputTokens = positiveInteger(usage.cachedInputTokens ?? 0);
  const inputTokens = Math.max(0, positiveInteger(usage.inputTokens) - cachedInputTokens);
  const outputTokens = positiveInteger(usage.outputTokens ?? 0);
  const cachedRate = pricing.cachedInputUsdPerMillionTokens ?? pricing.inputUsdPerMillionTokens;
  const outputRate = pricing.outputUsdPerMillionTokens ?? 0;

  return (
    microUsd(inputTokens, pricing.inputUsdPerMillionTokens) +
    microUsd(cachedInputTokens, cachedRate) +
    microUsd(outputTokens, outputRate)
  );
}
