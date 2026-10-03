import { Injectable } from '@nestjs/common';
import type { RunStatus } from '@qably/types';
import { PrismaService } from '../../prisma/prisma.service';
import type { OrgContext } from '../organizations/organizations.contracts';
import {
  CI_RUN_SELECT,
  toCiRunSummary,
  type CiRunRow,
} from './lib/ci-run-view';
import { deriveCiRunStatus } from './lib/derive-ci-run-status';
import type { CiRunsPageView } from './runs.contracts';
import type { ListCiRunsQuery } from './runs.schemas';

interface CiRunStatusGroup {
  ciRunId: string | null;
  status: RunStatus;
}

function groupStatusesByCiRun(
  groups: readonly CiRunStatusGroup[],
): Map<string, RunStatus[]> {
  const byCiRun = new Map<string, RunStatus[]>();
  for (const group of groups) {
    if (group.ciRunId === null) continue;
    const statuses = byCiRun.get(group.ciRunId) ?? [];
    statuses.push(group.status);
    byCiRun.set(group.ciRunId, statuses);
  }
  return byCiRun;
}

@Injectable()
export class CiRunsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(org: OrgContext, query: ListCiRunsQuery): Promise<CiRunsPageView> {
    const { projectId, limit, cursor } = query;

    const rows = (await this.prisma.ciRun.findMany({
      where: { organizationId: org.organizationId, projectId },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
      select: CI_RUN_SELECT,
    })) as CiRunRow[];

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    if (page.length === 0) return { items: [] };

    const groupsResult = await this.prisma.run.groupBy({
      by: ['ciRunId', 'status'],
      where: {
        organizationId: org.organizationId,
        ciRunId: { in: page.map((row) => row.id) },
      },
      orderBy: { ciRunId: 'asc' },
    });

    const statusesByCiRun = groupStatusesByCiRun(groupsResult);
    const items = page.map((row) =>
      toCiRunSummary(row, deriveCiRunStatus(statusesByCiRun.get(row.id) ?? [])),
    );

    return hasMore
      ? { items, nextCursor: page[page.length - 1].id }
      : { items };
  }
}
