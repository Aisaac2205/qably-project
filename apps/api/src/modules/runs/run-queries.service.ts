import { Injectable } from '@nestjs/common';
import type { CaseStatus, RunCaseCounts, RunStatus } from '@qably/types';
import { Prisma } from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import {
  buildCaseCountsByRun,
  computePassRate,
  emptyCaseCounts,
} from '../../common/metrics/run-case-metrics';
import { err, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { wasRegression } from '../notifications/lib/regression-check';
import { NotificationsPublisher } from '../notifications/notifications.publisher';
import { PrismaService } from '../../prisma/prisma.service';
import { deriveRunStatus } from './lib/derive-run-status';
import {
  CASE_READ_SELECT,
  CASE_SELECT,
  RUN_LIST_SELECT,
  RUN_SELECT,
  toRunView,
  type RunCaseRow,
  type RunListRow,
  type RunRow,
} from './lib/run-view';
import {
  buildSuiteMetrics,
  SUITE_METRICS_TREND_LIMIT,
  type RankedRunRow,
} from './lib/suite-metrics';
import type {
  RegressionsView,
  RunQueryError,
  RunsPageView,
  RunSummaryView,
  RunView,
  SuiteMetricsView,
} from './runs.contracts';
import type {
  CreateManualRunInput,
  ListRunsQuery,
  UpdateRunCaseStatusInput,
} from './runs.schemas';

const OPEN_CASE_STATUSES: readonly CaseStatus[] = ['pending', 'running'];

interface CaseReloadTx {
  runCase: {
    findMany: PrismaService['runCase']['findMany'];
  };
}

interface ScannedRunRow {
  id: string;
  name: string;
  suiteId: string;
  startedAt: Date;
  finishedAt: Date | null;
  suite: { name: string };
}

interface PreviousRunLinkRow {
  id: string;
  suiteId: string;
  previousId: string | null;
}

interface RegressionCaseRow {
  runId: string;
  testCaseId: string | null;
  name: string;
  status: CaseStatus;
}

function toSummaryView(run: RunListRow, counts: RunCaseCounts): RunSummaryView {
  const passRate = computePassRate(counts);

  return {
    id: run.id,
    projectId: run.projectId,
    organizationId: run.organizationId,
    suiteId: run.suiteId,
    suiteName: run.suite.name,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsPublisher,
  ) {}

  async list(org: OrgContext, query: ListRunsQuery): Promise<RunsPageView> {
    const { projectId, source, limit, cursor } = query;

    const rows = (await this.prisma.run.findMany({
      where: {
        organizationId: org.organizationId,
        ...(projectId === undefined ? {} : { projectId }),
        ...(source === undefined ? {} : { source }),
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      ...(limit === undefined ? {} : { take: limit + 1 }),
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
      select: RUN_LIST_SELECT,
    })) as RunListRow[];

    const hasMore = limit !== undefined && rows.length > limit;
    const runs = hasMore ? rows.slice(0, limit) : rows;

    if (runs.length === 0) return { items: [] };

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

    const countsByRun = buildCaseCountsByRun(groups);
    const items = runs.map((run) =>
      toSummaryView(run, countsByRun.get(run.id) ?? emptyCaseCounts()),
    );

    return hasMore
      ? { items, nextCursor: runs[runs.length - 1].id }
      : { items };
  }

  /**
   * Bounded per-suite metrics for the suites list: one query for the
   * project's suite ids, one ranked query for at most
   * SUITE_METRICS_TREND_LIMIT recent runs per suite, and one case-count
   * query scoped to just the most-recent run of each suite. Never loads
   * the project's full run history.
   */
  async suiteMetrics(
    org: OrgContext,
    projectId: string,
  ): Promise<SuiteMetricsView> {
    const suites = await this.prisma.suite.findMany({
      where: { projectId, organizationId: org.organizationId },
      select: { id: true },
    });

    if (suites.length === 0) return { items: [] };

    const suiteIds = suites.map((suite) => suite.id);

    const rankedRuns = await this.prisma.$queryRaw<RankedRunRow[]>(Prisma.sql`
      SELECT id, "suiteId", status, source, "startedAt", "finishedAt"
      FROM (
        SELECT id, "suiteId", status, source, "startedAt", "finishedAt",
          ROW_NUMBER() OVER (
            PARTITION BY "suiteId" ORDER BY "startedAt" DESC, "id" DESC
          ) AS rn
        FROM "run"
        WHERE "organizationId" = ${org.organizationId}
          AND "suiteId" IN (${Prisma.join(suiteIds)})
      ) ranked
      WHERE rn <= ${SUITE_METRICS_TREND_LIMIT}
      ORDER BY "suiteId" ASC, "startedAt" DESC, "id" DESC
    `);

    const lastRunIdBySuite = new Map<string, string>();
    for (const row of rankedRuns) {
      if (!lastRunIdBySuite.has(row.suiteId)) {
        lastRunIdBySuite.set(row.suiteId, row.id);
      }
    }

    const lastRunIds = [...lastRunIdBySuite.values()];
    let groups: {
      runId: string;
      status: CaseStatus;
      _count: { _all: number };
    }[] = [];

    if (lastRunIds.length > 0) {
      const groupsResult = await this.prisma.runCase.groupBy({
        by: ['runId', 'status'],
        where: { runId: { in: lastRunIds } },
        orderBy: { runId: 'asc' },
        _count: { _all: true },
      });
      groups = groupsResult;
    }

    const countsByRun = buildCaseCountsByRun(groups);
    const passRateByRunId = new Map<string, number>();
    for (const runId of lastRunIds) {
      passRateByRunId.set(
        runId,
        computePassRate(countsByRun.get(runId) ?? emptyCaseCounts()),
      );
    }

    return { items: buildSuiteMetrics(suiteIds, rankedRuns, passRateByRunId) };
  }

  /**
   * Bounded regression scan: one query for the latest `limit` finished runs
   * of the project, one window-function query resolving each of those
   * suites' previous-finished-run chain, and one `runCase.findMany` for
   * every run id involved. Never issues a per-case or per-run query.
   */
  async regressions(
    org: OrgContext,
    projectId: string,
    limit: number,
  ): Promise<RegressionsView> {
    const scannedRuns = (await this.prisma.run.findMany({
      where: {
        organizationId: org.organizationId,
        projectId,
        status: { in: ['pass', 'fail'] },
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: {
        id: true,
        name: true,
        suiteId: true,
        startedAt: true,
        finishedAt: true,
        suite: { select: { name: true } },
      },
    })) as ScannedRunRow[];

    if (scannedRuns.length === 0) return { items: [], runsScanned: 0 };

    const suiteIds = [...new Set(scannedRuns.map((run) => run.suiteId))];

    const chain = await this.prisma.$queryRaw<PreviousRunLinkRow[]>(Prisma.sql`
      SELECT id, "suiteId",
        LAG(id) OVER (
          PARTITION BY "suiteId" ORDER BY "startedAt" ASC, "id" ASC
        ) AS "previousId"
      FROM "run"
      WHERE "organizationId" = ${org.organizationId}
        AND "suiteId" IN (${Prisma.join(suiteIds)})
        AND status IN ('pass', 'fail')
        AND "finishedAt" IS NOT NULL
    `);

    const previousIdByRunId = new Map<string, string>();
    for (const row of chain) {
      if (row.previousId !== null)
        previousIdByRunId.set(row.id, row.previousId);
    }

    const previousRunIds = scannedRuns
      .map((run) => previousIdByRunId.get(run.id))
      .filter((id): id is string => id !== undefined);

    const involvedRunIds = [
      ...new Set([...scannedRuns.map((run) => run.id), ...previousRunIds]),
    ];

    const cases =
      involvedRunIds.length === 0
        ? []
        : ((await this.prisma.runCase.findMany({
            where: { runId: { in: involvedRunIds } },
            select: { runId: true, testCaseId: true, name: true, status: true },
          })) as RegressionCaseRow[]);

    const casesByRun = new Map<string, RegressionCaseRow[]>();
    for (const row of cases) {
      const list = casesByRun.get(row.runId) ?? [];
      list.push(row);
      casesByRun.set(row.runId, list);
    }

    const items: RegressionsView['items'] = [];

    for (const run of scannedRuns) {
      const previousRunId = previousIdByRunId.get(run.id);
      if (previousRunId === undefined) continue;

      const previousCases = casesByRun.get(previousRunId) ?? [];
      const currentCases = casesByRun.get(run.id) ?? [];

      for (const currentCase of currentCases) {
        if (currentCase.status !== 'fail') continue;
        if (currentCase.testCaseId === null) continue;
        if (!wasRegression(currentCase.testCaseId, previousCases)) continue;

        items.push({
          runId: run.id,
          runName: run.name,
          suiteId: run.suiteId,
          suiteName: run.suite.name,
          testCaseId: currentCase.testCaseId,
          caseName: currentCase.name,
          previousRunId,
          detectedAt: (run.finishedAt ?? run.startedAt).toISOString(),
        });
      }
    }

    return { items, runsScanned: scannedRuns.length };
  }

  async findOne(
    org: OrgContext,
    id: string,
  ): Promise<Result<RunView, RunQueryError>> {
    const run = await this.scoped(org, id);

    if (run === null) return err('not-found');

    const cases = await this.loadCases(this.prisma, id);

    return ok(toRunView(run, cases));
  }

  async createManual(
    org: OrgContext,
    user: AuthenticatedUser,
    input: CreateManualRunInput,
  ): Promise<Result<RunView, RunQueryError>> {
    const suite = await this.prisma.suite.findFirst({
      where: {
        id: input.suiteId,
        projectId: input.projectId,
        organizationId: org.organizationId,
      },
      select: {
        id: true,
        name: true,
        cases: {
          where: { state: 'active', executionMode: 'manual' },
          select: { id: true, name: true, steps: true, expectedResult: true },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (suite === null) return err('suite-not-found');
    if (suite.cases.length === 0) return err('no-manual-cases');

    const { run, cases } = await this.prisma.$transaction(async (tx) => {
      const run = await tx.run.create({
        data: {
          projectId: input.projectId,
          organizationId: org.organizationId,
          suiteId: suite.id,
          name: input.name ?? suite.name,
          status: 'pending',
          source: 'manual',
          externalId: null,
          executedById: user.id,
        },
        select: RUN_SELECT,
      });

      await tx.runCase.createManyAndReturn({
        data: suite.cases.map((testCase, index) => ({
          runId: run.id,
          testCaseId: testCase.id,
          name: testCase.name,
          suiteName: suite.name,
          steps: testCase.steps,
          expectedResult: testCase.expectedResult,
          status: 'pending',
          position: index,
        })),
        select: CASE_SELECT,
      });

      const cases = await this.loadCases(tx, run.id);

      return { run, cases };
    });

    return ok(toRunView(run, cases));
  }

  async updateCaseStatus(
    org: OrgContext,
    runId: string,
    caseId: string,
    input: UpdateRunCaseStatusInput,
  ): Promise<Result<RunView, RunQueryError>> {
    const run = await this.scoped(org, runId);

    if (run === null) return err('not-found');
    if (run.source !== 'manual') return err('source-not-editable');

    const cases = await this.loadCases(this.prisma, runId);
    const targetCase = cases.find((row) => row.id === caseId);

    if (targetCase === undefined) return err('case-not-found');

    await this.prisma.runCase.update({
      where: { id: caseId },
      data: { status: input.status, recordedAt: new Date() },
    });

    if (input.status === 'fail') {
      await this.checkRegression(org, run, targetCase);
    }

    const updatedCases = await this.loadCases(this.prisma, runId);
    const status = deriveRunStatus(updatedCases.map((row) => row.status));
    const stillOpen = updatedCases.some((row) =>
      OPEN_CASE_STATUSES.includes(row.status),
    );

    const updatedRun = await this.prisma.run.update({
      where: { id: runId },
      data: {
        status,
        ...(!stillOpen && run.finishedAt === null
          ? { finishedAt: new Date() }
          : {}),
      },
      select: RUN_SELECT,
    });

    await this.publishTerminalTransition(
      org,
      run.status,
      updatedRun,
      updatedCases,
    );

    return ok(toRunView(updatedRun, updatedCases));
  }

  private async checkRegression(
    org: OrgContext,
    run: RunRow,
    targetCase: RunCaseRow,
  ): Promise<void> {
    const previousRun = await this.prisma.run.findFirst({
      where: {
        suiteId: run.suiteId,
        projectId: run.projectId,
        status: { in: ['pass', 'fail'] },
        finishedAt: { not: null },
        startedAt: { lt: run.startedAt },
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    });

    if (previousRun === null) return;

    const previousCases = await this.prisma.runCase.findMany({
      where: { runId: previousRun.id },
      select: { testCaseId: true, status: true },
    });

    if (!wasRegression(targetCase.testCaseId, previousCases)) return;

    await this.notifications.publish({
      eventType: 'case_regressed',
      organizationId: org.organizationId,
      severity: 'high',
      payload: {
        caseName: targetCase.name,
        suiteName: targetCase.suiteName,
        runName: run.name,
      },
      dedupeKey: `case_regressed:${run.id}:${targetCase.testCaseId ?? ''}`,
      projectId: run.projectId,
      runId: run.id,
      ...(targetCase.testCaseId === null
        ? {}
        : { testCaseId: targetCase.testCaseId }),
    });
  }

  private async publishTerminalTransition(
    org: OrgContext,
    previousStatus: RunStatus,
    updatedRun: RunRow,
    cases: RunCaseRow[],
  ): Promise<void> {
    if (updatedRun.status === previousStatus) return;
    if (updatedRun.status !== 'fail' && updatedRun.status !== 'pass') return;

    const eventType =
      updatedRun.status === 'fail' ? 'run_failed' : 'run_completed';

    await this.notifications.publish({
      eventType,
      organizationId: org.organizationId,
      severity: eventType === 'run_failed' ? 'high' : 'low',
      payload: {
        runName: updatedRun.name,
        suiteName: cases[0]?.suiteName ?? '',
      },
      dedupeKey: `${eventType}:${updatedRun.id}`,
      projectId: updatedRun.projectId,
      runId: updatedRun.id,
    });
  }

  private scoped(org: OrgContext, id: string): Promise<RunRow | null> {
    return this.prisma.run.findFirst({
      where: { id, organizationId: org.organizationId },
      select: RUN_SELECT,
    });
  }

  private loadCases(
    client: CaseReloadTx,
    runId: string,
  ): Promise<RunCaseRow[]> {
    return client.runCase.findMany({
      where: { runId },
      select: CASE_READ_SELECT,
      orderBy: { position: 'asc' },
    });
  }
}
