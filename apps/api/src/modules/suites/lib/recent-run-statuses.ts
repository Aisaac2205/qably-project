import { SUITE_RUN_WINDOW, type RunStatus } from '@qably/types';
import { Prisma } from '../../../../generated/prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';

export interface RecentRunStatusRow {
  suiteId: string;
  status: RunStatus;
}

export interface RecentRunStatusReader {
  $queryRaw: PrismaService['$queryRaw'];
}

export function recentRunStatusesSql(
  organizationId: string,
  suiteIds: readonly string[],
): Prisma.Sql {
  return Prisma.sql`
    SELECT s.id AS "suiteId", w.status
    FROM "suite" s
    CROSS JOIN LATERAL (
      SELECT r.status, r."startedAt", r.id
      FROM "run" r
      WHERE r."suiteId" = s.id
      ORDER BY r."startedAt" DESC, r.id DESC
      LIMIT ${SUITE_RUN_WINDOW}
    ) w
    WHERE s."organizationId" = ${organizationId}
      AND s.id IN (${Prisma.join(suiteIds)})
    ORDER BY s.id ASC, w."startedAt" DESC, w.id DESC
  `;
}

export function groupStatusesBySuite(
  rows: readonly RecentRunStatusRow[],
): Map<string, RunStatus[]> {
  const bySuite = new Map<string, RunStatus[]>();

  for (const { suiteId, status } of rows) {
    const statuses = bySuite.get(suiteId);

    if (statuses === undefined) {
      bySuite.set(suiteId, [status]);
    } else {
      statuses.push(status);
    }
  }

  for (const statuses of bySuite.values()) {
    statuses.reverse();
  }

  return bySuite;
}

export async function readRecentRunStatuses(
  prisma: RecentRunStatusReader,
  organizationId: string,
  suiteIds: readonly string[],
): Promise<Map<string, RunStatus[]>> {
  if (suiteIds.length === 0) {
    return new Map();
  }

  const rows = await prisma.$queryRaw<RecentRunStatusRow[]>(
    recentRunStatusesSql(organizationId, suiteIds),
  );

  return groupStatusesBySuite(rows);
}
