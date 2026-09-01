import { Injectable } from '@nestjs/common';
import type { CaseStatus, RunCaseCounts } from '@qably/types';
import { err, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CASE_SELECT,
  RUN_SELECT,
  toRunView,
  type RunCaseRow,
  type RunRow,
} from './lib/run-view';
import type { RunQueryError, RunSummaryView, RunView } from './runs.contracts';

const ZERO_COUNTS: RunCaseCounts = {
  total: 0,
  pending: 0,
  running: 0,
  pass: 0,
  fail: 0,
  skip: 0,
  blocked: 0,
};

function buildCaseCounts(
  groups: { runId: string; status: CaseStatus; _count: { _all: number } }[],
): Map<string, RunCaseCounts> {
  const countsByRun = new Map<string, RunCaseCounts>();

  for (const group of groups) {
    const counts = countsByRun.get(group.runId) ?? { ...ZERO_COUNTS };

    counts[group.status] += group._count._all;
    counts.total += group._count._all;
    countsByRun.set(group.runId, counts);
  }

  return countsByRun;
}

function toSummaryView(run: RunRow, counts: RunCaseCounts): RunSummaryView {
  const passRate = counts.total === 0 ? 0 : counts.pass / counts.total;

  return {
    id: run.id,
    projectId: run.projectId,
    organizationId: run.organizationId,
    suiteId: run.suiteId,
    name: run.name,
    status: run.status,
    source: run.source,
    externalId: run.externalId ?? '',
    startedAt: run.startedAt.toISOString(),
    ...(run.finishedAt === null
      ? {}
      : { finishedAt: run.finishedAt.toISOString() }),
    ...(run.executedById === null ? {} : { executedById: run.executedById }),
    ...(run.commitSha === null ? {} : { commitSha: run.commitSha }),
    ...(run.commitMessage === null ? {} : { commitMessage: run.commitMessage }),
    ...(run.commitAuthor === null ? {} : { commitAuthor: run.commitAuthor }),
    caseCounts: counts,
    passRate,
  };
}

@Injectable()
export class RunQueriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(org: OrgContext, projectId?: string): Promise<RunSummaryView[]> {
    const runs = (await this.prisma.run.findMany({
      where: {
        organizationId: org.organizationId,
        ...(projectId === undefined ? {} : { projectId }),
      },
      orderBy: { startedAt: 'desc' },
      select: RUN_SELECT,
    })) as RunRow[];

    if (runs.length === 0) return [];

    const groupsResult = await this.prisma.runCase.groupBy({
      by: ['runId', 'status'],
      where: { runId: { in: runs.map((run) => run.id) } },
      orderBy: { runId: 'asc' },
      _count: { _all: true },
    });
    const groups = groupsResult as {
      runId: string;
      status: CaseStatus;
      _count: { _all: number };
    }[];

    const countsByRun = buildCaseCounts(groups);

    return runs.map((run) =>
      toSummaryView(run, countsByRun.get(run.id) ?? { ...ZERO_COUNTS }),
    );
  }

  async findOne(
    org: OrgContext,
    id: string,
  ): Promise<Result<RunView, RunQueryError>> {
    const run = await this.scoped(org, id);

    if (run === null) return err('not-found');

    const cases = await this.loadCases(id);

    return ok(toRunView(run, cases));
  }

  private scoped(org: OrgContext, id: string): Promise<RunRow | null> {
    return this.prisma.run.findFirst({
      where: { id, organizationId: org.organizationId },
      select: RUN_SELECT,
    });
  }

  private loadCases(runId: string): Promise<RunCaseRow[]> {
    return this.prisma.runCase.findMany({
      where: { runId },
      select: CASE_SELECT,
      orderBy: { position: 'asc' },
    });
  }
}
