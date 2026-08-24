import { Prisma } from '../../../../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';

const deletionDocumentSelect = {
  id: true,
  userId: true,
  storageKey: true,
  deletedAt: true,
} as const;

export type DeletionDocument = Prisma.DocumentGetPayload<{
  select: typeof deletionDocumentSelect;
}>;

export async function findDocumentForDeletion(
  documentId: string,
  userId: string,
): Promise<DeletionDocument | null> {
  return prisma.document.findFirst({
    where: {
      id: documentId,
      userId,
      deletedAt: { not: null },
    },
    select: deletionDocumentSelect,
  });
}

export async function permanentlyDeleteDocumentData(
  documentId: string,
  userId: string,
  deletedAt: Date,
): Promise<boolean> {
  return prisma.$transaction(async (transaction) => {
    await transaction.documentChunk.deleteMany({
      where: {
        documentId,
        document: {
          userId,
          deletedAt,
        },
      },
    });

    const deleted = await transaction.document.deleteMany({
      where: {
        id: documentId,
        userId,
        deletedAt,
      },
    });

    return deleted.count === 1;
  });
}
