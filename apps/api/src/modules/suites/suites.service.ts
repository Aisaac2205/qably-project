import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import type {
  CaseHealthSummary,
  CaseLastResult,
  CaseStatus,
  ExecutionMode,
} from '@qably/types';
import {
  deriveCaseHealth,
  type CaseHealthInput,
  type CaseHealthResult,
} from '../../common/quality/case-health';
import { err, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { PrismaService } from '../../prisma/prisma.service';
import type { SuiteError, SuiteView, TestCaseView } from './suites.contracts';
import type {
  CreateCaseInput,
  CreateSuiteInput,
  UpdateCaseInput,
  UpdateSuiteInput,
} from './suites.schemas';

const UNIQUE_VIOLATION = 'P2002';
const PENDING_STATUS = 'in_review';
const FLAKY_WINDOW_SIZE = 6;
const RESULT_STATUSES = new Set<CaseHealthResult>([
  'pass',
  'fail',
  'skip',
  'blocked',
]);

const CASE_SELECT = {
  id: true,
  suiteId: true,
  name: true,
  steps: true,
  expectedResult: true,
  priority: true,
  state: true,
  executionMode: true,
  automationKey: true,
  automationClassName: true,
  automationFilePath: true,
  currentVersion: { select: { version: true, locale: true } },
} as const;

const SUITE_SELECT = {
  id: true,
  projectId: true,
  organizationId: true,
  name: true,
  description: true,
  tags: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
  cases: { select: CASE_SELECT, orderBy: { position: 'asc' } },
} as const;

interface CaseRow {
  id: string;
  suiteId: string;
  name: string;
  steps: string[];
  expectedResult: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  state: 'active' | 'draft' | 'deprecated';
  executionMode: ExecutionMode;
  automationKey: string | null;
  automationClassName: string | null;
  automationFilePath: string | null;
  currentVersion: { version: number; locale?: string | null } | null;
}

interface PendingProposalRow {
  id: string;
  targetTestCaseId: string | null;
}

interface LastResultRow {
  testCaseId: string | null;
  status: CaseStatus;
  recordedAt: Date | null;
  run: { id: string; commitSha: string | null; startedAt: Date };
}

interface RecentResultRow {
  test_case_id: string;
  status: string;
}

interface DuplicateKeyCandidateRow {
  id: string;
  suiteId: string;
  projectId: string;
  automationKey: string | null;
}

interface SuiteRow {
  id: string;
  projectId: string;
  organizationId: string;
  name: string;
  description: string;
  tags: string[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  cases: CaseRow[];
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

function toCaseView(testCase: CaseRow): TestCaseView {
  const base = {
    id: testCase.id,
    suiteId: testCase.suiteId,
    version: testCase.currentVersion?.version ?? null,
    documentedLocale: testCase.currentVersion?.locale ?? null,
    name: testCase.name,
    steps: testCase.steps,
    expectedResult: testCase.expectedResult,
    priority: testCase.priority,
    state: testCase.state,
    executionMode: testCase.executionMode,
  };

  if (testCase.executionMode !== 'automated') return base;

  return {
    ...base,
    ...(testCase.automationKey === null
      ? {}
      : { automationKey: testCase.automationKey }),
    ...(testCase.automationClassName === null
      ? {}
      : { automationClassName: testCase.automationClassName }),
    ...(testCase.automationFilePath === null
      ? {}
      : { automationFilePath: testCase.automationFilePath }),
    lastResult: null,
  };
}

function toView(row: SuiteRow): SuiteView {
  const cases = row.cases.map(toCaseView);
  const automatedCases = cases.filter(
    (testCase) => testCase.executionMode === 'automated',
  ).length;

  return {
    id: row.id,
    projectId: row.projectId,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description,
    tags: row.tags,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    manualCases: cases.length - automatedCases,
    automatedCases,
    cases,
  };
}

function canWrite(org: OrgContext): boolean {
  return org.role === 'owner' || org.role === 'admin';
}

@Injectable()
export class SuitesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(org: OrgContext, projectId?: string): Promise<SuiteView[]> {
    const rows = await this.prisma.suite.findMany({
      where: {
        organizationId: org.organizationId,
        ...(projectId === undefined ? {} : { projectId }),
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: SUITE_SELECT,
    });

    return this.withLastResults(rows.map(toView));
  }

  async findOne(
    org: OrgContext,
    id: string,
  ): Promise<Result<SuiteView, SuiteError>> {
    const row = await this.scoped(org, id);

    if (row === null) return err('not-found');

    return ok(await this.withLastResult(toView(row)));
  }

  async create(
    org: OrgContext,
    input: CreateSuiteInput,
  ): Promise<Result<SuiteView, SuiteError>> {
    const project = await this.prisma.project.findFirst({
      where: { id: input.projectId, organizationId: org.organizationId },
      select: { id: true },
    });

    if (project === null) return err('not-found');

    const { isDefault, ...rest } = input;

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        if (isDefault) await this.clearDefault(tx, input.projectId);

        return tx.suite.create({
          data: { ...rest, isDefault, organizationId: org.organizationId },
          select: SUITE_SELECT,
        });
      });

      return ok(await this.withLastResult(toView(row)));
    } catch (error) {
      if (isUniqueViolation(error)) return err('name-taken');
      throw error;
    }
  }

  async update(
    org: OrgContext,
    id: string,
    input: UpdateSuiteInput,
  ): Promise<Result<SuiteView, SuiteError>> {
    const existing = await this.scoped(org, id);

    if (existing === null) return err('not-found');

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        if (input.isDefault === true) {
          await this.clearDefault(tx, existing.projectId, id);
        }

        return tx.suite.update({
          where: { id },
          data: {
            ...input,
            ...(input.name === undefined ? {} : { nameSource: 'human' }),
          },
          select: SUITE_SELECT,
        });
      });

      return ok(await this.withLastResult(toView(row)));
    } catch (error) {
      if (isUniqueViolation(error)) return err('name-taken');
      throw error;
    }
  }

  async remove(org: OrgContext, id: string): Promise<Result<void, SuiteError>> {
    if (!canWrite(org)) return err('forbidden');

    const existing = await this.scoped(org, id);

    if (existing === null) return err('not-found');

    await this.prisma.suite.delete({ where: { id } });

    return ok(undefined);
  }

  async addCase(
    org: OrgContext,
    suiteId: string,
    input: CreateCaseInput,
  ): Promise<Result<SuiteView, SuiteError>> {
    const existing = await this.scoped(org, suiteId);

    if (existing === null) return err('not-found');

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.testCase.create({
        data: {
          ...input,
          suiteId,
          projectId: existing.projectId,
          position: existing.cases.length,
        },
      });

      return tx.suite.findUniqueOrThrow({
        where: { id: suiteId },
        select: SUITE_SELECT,
      });
    });

    return ok(await this.withLastResult(toView(row)));
  }

  async updateCase(
    org: OrgContext,
    suiteId: string,
    caseId: string,
    input: UpdateCaseInput,
  ): Promise<Result<SuiteView, SuiteError>> {
    const existing = await this.scoped(org, suiteId);

    if (existing === null) return err('not-found');
    if (!existing.cases.some((testCase) => testCase.id === caseId)) {
      return err('not-found');
    }

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.testCase.update({ where: { id: caseId }, data: input });

      return tx.suite.findUniqueOrThrow({
        where: { id: suiteId },
        select: SUITE_SELECT,
      });
    });

    return ok(await this.withLastResult(toView(row)));
  }

  async removeCase(
    org: OrgContext,
    suiteId: string,
    caseId: string,
  ): Promise<Result<SuiteView, SuiteError>> {
    const existing = await this.scoped(org, suiteId);

    if (existing === null) return err('not-found');
    if (!existing.cases.some((testCase) => testCase.id === caseId)) {
      return err('not-found');
    }

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.testCase.delete({ where: { id: caseId } });

      return tx.suite.findUniqueOrThrow({
        where: { id: suiteId },
        select: SUITE_SELECT,
      });
    });

    return ok(await this.withLastResult(toView(row)));
  }

  private async withLastResult(view: SuiteView): Promise<SuiteView> {
    const [withResult] = await this.withLastResults([view]);
    return withResult;
  }

  private async withLastResults(views: SuiteView[]): Promise<SuiteView[]> {
    const allCaseIds = views.flatMap((view) =>
      view.cases.map((testCase) => testCase.id),
    );
    const automatedCaseIds = views.flatMap((view) =>
      view.cases
        .filter((testCase) => testCase.executionMode === 'automated')
        .map((testCase) => testCase.id),
    );
    const projectIds = [...new Set(views.map((view) => view.projectId))];
    const automationKeys = [
      ...new Set(
        views.flatMap((view) =>
          view.cases
            .map((testCase) => testCase.automationKey)
            .filter((key): key is string => typeof key === 'string'),
        ),
      ),
    ];

    const [
      lastResultRows,
      pendingProposalRows,
      recentResultRows,
      duplicateKeyRows,
    ] = await Promise.all([
      automatedCaseIds.length === 0
        ? Promise.resolve([] as LastResultRow[])
        : (this.prisma.runCase.findMany({
            where: { testCaseId: { in: automatedCaseIds } },
            orderBy: [{ run: { startedAt: 'desc' } }, { id: 'desc' }],
            distinct: ['testCaseId'],
            select: {
              testCaseId: true,
              status: true,
              recordedAt: true,
              run: {
                select: { id: true, commitSha: true, startedAt: true },
              },
            },
          }) as Promise<LastResultRow[]>),
      allCaseIds.length === 0
        ? Promise.resolve([] as PendingProposalRow[])
        : (this.prisma.extractedProposal.findMany({
            where: {
              targetTestCaseId: { in: allCaseIds },
              status: PENDING_STATUS,
            },
            orderBy: { createdAt: 'asc' },
            select: { id: true, targetTestCaseId: true },
          }) as Promise<PendingProposalRow[]>),
      automatedCaseIds.length === 0
        ? Promise.resolve([] as RecentResultRow[])
        : (this.prisma.$queryRaw(Prisma.sql`
              SELECT test_case_id, id, status, started_at
              FROM (
                SELECT rc.id AS id, rc."testCaseId" AS test_case_id, rc.status,
                  r."startedAt" AS started_at,
                  ROW_NUMBER() OVER (
                    PARTITION BY rc."testCaseId" ORDER BY r."startedAt" DESC, rc.id DESC
                  ) AS rn
                FROM "run_case" rc
                JOIN "run" r ON r.id = rc."runId"
                WHERE rc."testCaseId" IN (${Prisma.join(automatedCaseIds)})
                  AND rc.status IN ('pass', 'fail', 'skip', 'blocked')
                  AND r."finishedAt" IS NOT NULL
              ) ranked
              WHERE rn <= ${FLAKY_WINDOW_SIZE}
              ORDER BY test_case_id ASC, started_at DESC, id DESC
            `) as Promise<RecentResultRow[]>),
      automationKeys.length === 0
        ? Promise.resolve([] as DuplicateKeyCandidateRow[])
        : (this.prisma.testCase.findMany({
            where: {
              projectId: { in: projectIds },
              automationKey: { in: automationKeys },
            },
            select: {
              id: true,
              suiteId: true,
              projectId: true,
              automationKey: true,
            },
          }) as Promise<DuplicateKeyCandidateRow[]>),
    ]);

    const lastResultByCaseId = new Map<string, CaseLastResult>();
    for (const row of lastResultRows) {
      if (row.testCaseId === null) continue;

      lastResultByCaseId.set(row.testCaseId, {
        status: row.status,
        runId: row.run.id,
        ...(row.run.commitSha === null ? {} : { commitSha: row.run.commitSha }),
        recordedAt: (row.recordedAt ?? row.run.startedAt).toISOString(),
      });
    }

    const pendingProposalByCaseId = new Map<string, string>();
    for (const row of pendingProposalRows) {
      if (row.targetTestCaseId === null) continue;
      pendingProposalByCaseId.set(row.targetTestCaseId, row.id);
    }

    const recentResultsByCaseId = new Map<
      string,
      CaseHealthInput['recentResults'][number][]
    >();
    for (const row of recentResultRows) {
      if (
        !RESULT_STATUSES.has(
          row.status as CaseHealthInput['recentResults'][number],
        )
      ) {
        continue;
      }
      const results = recentResultsByCaseId.get(row.test_case_id) ?? [];
      results.push(row.status as CaseHealthInput['recentResults'][number]);
      recentResultsByCaseId.set(row.test_case_id, results);
    }

    const visibleInputs: CaseHealthInput[] = views.flatMap((view) =>
      view.cases.map((testCase) => ({
        id: testCase.id,
        suiteId: testCase.suiteId,
        projectId: view.projectId,
        name: testCase.name,
        automationKey: testCase.automationKey ?? null,
        executionMode: testCase.executionMode,
        steps: testCase.steps,
        recentResults: recentResultsByCaseId.get(testCase.id) ?? [],
        hasAnyRun: recentResultsByCaseId.has(testCase.id),
      })),
    );

    const visibleCaseIds = new Set(visibleInputs.map((input) => input.id));
    const shadowInputs: CaseHealthInput[] = duplicateKeyRows
      .filter((row) => !visibleCaseIds.has(row.id))
      .map((row) => ({
        id: row.id,
        suiteId: row.suiteId,
        projectId: row.projectId,
        name: '',
        automationKey: row.automationKey,
        executionMode: 'automated' as const,
        steps: [],
        recentResults: [],
        hasAnyRun: false,
      }));

    const healthSignalsByCaseId = deriveCaseHealth([
      ...visibleInputs,
      ...shadowInputs,
    ]);

    return views.map((view) => {
      const cases = view.cases.map((testCase) => ({
        ...(testCase.executionMode === 'automated'
          ? {
              ...testCase,
              lastResult: lastResultByCaseId.get(testCase.id) ?? null,
            }
          : testCase),
        pendingProposalId: pendingProposalByCaseId.get(testCase.id) ?? null,
        healthSignals: [...(healthSignalsByCaseId.get(testCase.id) ?? [])],
      }));

      const healthSummary: CaseHealthSummary = {};
      for (const testCase of cases) {
        for (const signal of testCase.healthSignals) {
          healthSummary[signal] = (healthSummary[signal] ?? 0) + 1;
        }
      }

      return { ...view, cases, healthSummary };
    });
  }

  private scoped(org: OrgContext, id: string): Promise<SuiteRow | null> {
    return this.prisma.suite.findFirst({
      where: { id, organizationId: org.organizationId },
      select: SUITE_SELECT,
    });
  }

  private async clearDefault(
    tx: { suite: { updateMany: PrismaService['suite']['updateMany'] } },
    projectId: string,
    exceptId?: string,
  ): Promise<void> {
    await tx.suite.updateMany({
      where: {
        projectId,
        isDefault: true,
        ...(exceptId === undefined ? {} : { id: { not: exceptId } }),
      },
      data: { isDefault: false },
    });
  }
}
