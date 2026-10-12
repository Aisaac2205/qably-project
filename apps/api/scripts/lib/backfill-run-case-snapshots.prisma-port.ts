import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import type { SnapshotBackfillPort } from './backfill-run-case-snapshots.lib';

export function createPrismaSnapshotBackfillPort(
  prisma: PrismaClient,
): SnapshotBackfillPort {
  return {
    countSnapshotted: () =>
      prisma.runCase.count({
        where: { catalogSnapshot: { not: Prisma.DbNull } },
      }),

    readUnsnapshotted: async (afterId, take) => {
      const rows = await prisma.runCase.findMany({
        where: {
          catalogSnapshot: { equals: Prisma.DbNull },
          ...(afterId === undefined ? {} : { id: { gt: afterId } }),
        },
        orderBy: { id: 'asc' },
        take,
        select: {
          id: true,
          testCaseId: true,
          run: { select: { startedAt: true } },
        },
      });

      return rows.map((row) => ({
        id: row.id,
        testCaseId: row.testCaseId,
        runStartedAt: row.run.startedAt,
      }));
    },

    readPublishedVersions: (testCaseIds, publishedUpTo) =>
      prisma.testCaseVersion.findMany({
        where: {
          testCaseId: { in: [...testCaseIds] },
          publishedAt: { lte: publishedUpTo },
        },
        select: {
          id: true,
          testCaseId: true,
          version: true,
          title: true,
          steps: true,
          expectedResult: true,
          publishedAt: true,
        },
      }),

    applyFills: async (groups) => {
      if (groups.length === 0) return 0;

      const results = await prisma.$transaction(
        groups.map((group) =>
          prisma.runCase.updateMany({
            where: {
              id: { in: [...group.runCaseIds] },
              testCaseId: group.testCaseId,
              catalogSnapshot: { equals: Prisma.DbNull },
            },
            data: {
              testCaseVersionId: group.testCaseVersionId,
              catalogSnapshot: group.snapshot,
            },
          }),
        ),
      );

      return results.reduce((written, result) => written + result.count, 0);
    },
  };
}
