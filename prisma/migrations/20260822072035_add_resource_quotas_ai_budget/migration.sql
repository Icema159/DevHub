-- CreateEnum
CREATE TYPE "DocumentQuotaReservationPurpose" AS ENUM ('UPLOAD', 'DELETE_ROLLBACK');

-- CreateEnum
CREATE TYPE "AiTurnReservationStatus" AS ENUM ('RESERVED', 'COMMITTED');

-- CreateEnum
CREATE TYPE "AiOperation" AS ENUM ('QUESTION_EMBEDDING', 'ANSWER_GENERATION', 'TITLE_GENERATION', 'DOCUMENT_EMBEDDING');

-- CreateEnum
CREATE TYPE "AiBudgetReservationStatus" AS ENUM ('RESERVED', 'COMMITTED', 'RELEASED');

-- CreateEnum
CREATE TYPE "AiUsageSource" AS ENUM ('PROVIDER_REPORTED', 'CONSERVATIVE_ESTIMATE');

-- CreateTable
CREATE TABLE "DocumentQuotaReservation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "DocumentQuotaReservationPurpose" NOT NULL,
    "documentCount" INTEGER NOT NULL,
    "storageBytes" BIGINT NOT NULL,
    "processingSlots" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentQuotaReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTurnReservation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AiTurnReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "committedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AiTurnReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiBudgetPeriod" (
    "periodStart" TIMESTAMPTZ(3) NOT NULL,
    "committedMicroUsd" BIGINT NOT NULL DEFAULT 0,
    "reservedMicroUsd" BIGINT NOT NULL DEFAULT 0,
    "warning50At" TIMESTAMPTZ(3),
    "warning80At" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AiBudgetPeriod_pkey" PRIMARY KEY ("periodStart")
);

-- CreateTable
CREATE TABLE "AiBudgetReservation" (
    "id" TEXT NOT NULL,
    "periodStart" TIMESTAMPTZ(3) NOT NULL,
    "userId" TEXT,
    "operation" "AiOperation" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" "AiBudgetReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "reservedMicroUsd" BIGINT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AiBudgetReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageRecord" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "userId" TEXT,
    "operation" "AiOperation" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "cachedInputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedMicroUsd" BIGINT NOT NULL,
    "source" "AiUsageSource" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentQuotaReservation_userId_expiresAt_idx" ON "DocumentQuotaReservation"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "DocumentQuotaReservation_expiresAt_idx" ON "DocumentQuotaReservation"("expiresAt");

-- CreateIndex
CREATE INDEX "AiTurnReservation_userId_status_committedAt_idx" ON "AiTurnReservation"("userId", "status", "committedAt");

-- CreateIndex
CREATE INDEX "AiTurnReservation_status_expiresAt_idx" ON "AiTurnReservation"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "AiBudgetReservation_periodStart_status_expiresAt_idx" ON "AiBudgetReservation"("periodStart", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "AiBudgetReservation_userId_createdAt_idx" ON "AiBudgetReservation"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiUsageRecord_reservationId_key" ON "AiUsageRecord"("reservationId");

-- CreateIndex
CREATE INDEX "AiUsageRecord_createdAt_idx" ON "AiUsageRecord"("createdAt");

-- CreateIndex
CREATE INDEX "AiUsageRecord_userId_createdAt_idx" ON "AiUsageRecord"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageRecord_operation_createdAt_idx" ON "AiUsageRecord"("operation", "createdAt");

-- AddForeignKey
ALTER TABLE "DocumentQuotaReservation" ADD CONSTRAINT "DocumentQuotaReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTurnReservation" ADD CONSTRAINT "AiTurnReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiBudgetReservation" ADD CONSTRAINT "AiBudgetReservation_periodStart_fkey" FOREIGN KEY ("periodStart") REFERENCES "AiBudgetPeriod"("periodStart") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiBudgetReservation" ADD CONSTRAINT "AiBudgetReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageRecord" ADD CONSTRAINT "AiUsageRecord_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "AiBudgetReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageRecord" ADD CONSTRAINT "AiUsageRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
