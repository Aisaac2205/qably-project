import type { PrismaClient } from '../../generated/prisma/client';
import type { BackfillPort } from './backfill-ci-runs.lib';

export function createPrismaBackfillPort(prisma: PrismaClient): BackfillPort {
  return {
    readUnlinkedRuns: (afterId, take) =>
      prisma.run.findMany({
        where: {
          ciRunId: null,
          ...(afterId === undefined ? {} : { id: { gt: afterId } }),
        },
        orderBy: { id: 'asc' },
        take,
        select: {
          id: true,
          projectId: true,
          organizationId: true,
          source: true,
          externalId: true,
          startedAt: true,
          commitSha: true,
          commitMessage: true,
          commitAuthor: true,
        },
      }),

    findCiRun: (key) =>
      prisma.ciRun.findUnique({
        where: { projectId_source_externalId: key },
        select: {
          id: true,
          startedAt: true,
          lastReportedAt: true,
          commitSha: true,
          commitMessage: true,
          commitAuthor: true,
        },
      }),

    createCiRun: async (input) => {
      const row = await prisma.ciRun.create({
        data: input,
        select: { id: true },
      });
      return row.id;
    },

    updateCiRun: async (id, patch) => {
      await prisma.ciRun.update({ where: { id }, data: patch });
    },

    linkRuns: async (ciRunId, runIds) => {
      const result = await prisma.run.updateMany({
        where: { id: { in: [...runIds] }, ciRunId: null },
        data: { ciRunId },
      });
      return result.count;
    },
  };
}
