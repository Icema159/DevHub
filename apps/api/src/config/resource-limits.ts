export const RESOURCE_LIMITS = Object.freeze({
  perUserDocuments: 25,
  perUserStorageBytes: 150n * 1024n * 1024n,
  perUserAiTurns24Hours: 30,
  perUserProcessingPipelines: 2,
  perIpUploadAttemptsPerHour: 20,
  perIpAiAttemptsPerHour: 60,
  documentReservationTtlMs: 15 * 60 * 1000,
  aiTurnReservationTtlMs: 10 * 60 * 1000,
  aiBudgetReservationTtlMs: 15 * 60 * 1000,
});
