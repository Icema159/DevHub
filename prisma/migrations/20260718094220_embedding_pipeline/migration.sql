-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentStatus" ADD VALUE 'CHUNKS_READY';
ALTER TYPE "DocumentStatus" ADD VALUE 'EMBEDDING';

-- Constrain stored embeddings to the approved text-embedding-3-small dimension.
-- A similarity index is intentionally deferred until retrieval performance is measured.
ALTER TABLE "DocumentChunk"
ALTER COLUMN "embedding" TYPE vector(1536)
USING "embedding"::vector(1536);
