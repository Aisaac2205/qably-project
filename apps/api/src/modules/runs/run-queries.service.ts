import { Injectable } from '@nestjs/common';
import type { CaseStatus, RunCaseCounts, RunStatus } from '@qably/types';
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
  CASE_SELECT,
  RUN_SELECT,
  toRunView,
  type RunCaseRow,
  type RunRow,
} from './lib/run-view';
import type { RunQueryError, RunSummaryView, RunView } from './runs.contracts';
import type {
  CreateManualRunInput,
  UpdateRunCaseStatusInput,
} from './runs.schemas';

const OPEN_CASE_STATUSES: readonly CaseStatus[] = ['pending', 'running'];

function toSummaryView(run: RunRow, counts: RunCaseCounts): RunSummaryView {
  const passRate = computePassRate(counts);

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsPublisher,
  ) {}

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

    const countsByRun = buildCaseCountsByRun(groups);

    return runs.map((run) =>
      toSummaryView(run, countsByRun.get(run.id) ?? emptyCaseCounts()),
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
          where: { state: 'active' },
          select: { id: true, name: true, steps: true, expectedResult: true },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (suite === null) return err('suite-not-found');
    if (suite.cases.length === 0) return err('empty-suite');

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

      const cases = (await tx.runCase.createManyAndReturn({
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
      })) as RunCaseRow[];

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

    const cases = await this.loadCases(runId);
    const targetCase = cases.find((row) => row.id === caseId);

    if (targetCase === undefined) return err('case-not-found');

    await this.prisma.runCase.update({
      where: { id: caseId },
      data: { status: input.status, recordedAt: new Date() },
    });

    if (input.status === 'fail') {
      await this.checkRegression(org, run, targetCase);
    }

    const updatedCases = await this.loadCases(runId);
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

  private loadCases(runId: string): Promise<RunCaseRow[]> {
    return this.prisma.runCase.findMany({
      where: { runId },
      select: CASE_SELECT,
      orderBy: { position: 'asc' },
    });
  }
}
