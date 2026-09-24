import { Injectable } from '@nestjs/common';
import type { Locale } from '@qably/i18n';
import { Prisma } from '../../../generated/prisma/client';
import type {
  CaseHealthSummary,
  CaseLastResult,
  CaseStatus,
} from '@qably/types';
import {
  deriveCaseHealth,
  type CaseHealthInput,
  type CaseHealthResult,
} from '../../common/quality/case-health';
import { isCaseDocumentable } from '../../common/locale/documentable-case';
import { PrismaService } from '../../prisma/prisma.service';
import type { SuiteView } from './suites.contracts';
import type { SuiteRow } from './lib/suite-view';

const PENDING_STATUS = 'in_review';
const FLAKY_WINDOW_SIZE = 6;
const RESULT_STATUSES = new Set<CaseHealthResult>([
  'pass',
  'fail',
  'skip',
  'blocked',
]);

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

@Injectable()
export class SuiteViewAssembler {
  constructor(private readonly prisma: PrismaService) {}

  async withLastResult(
    view: SuiteView,
    row: SuiteRow,
    orgDefaultLocale: Locale,
  ): Promise<SuiteView> {
    const [withResult] = await this.withLastResults(
      [view],
      [row],
      orgDefaultLocale,
    );
    return withResult;
  }

  async withLastResults(
    views: SuiteView[],
    rows: SuiteRow[],
    orgDefaultLocale: Locale,
  ): Promise<SuiteView[]> {
    const docStateByCaseId = new Map<
      string,
      { documentationSource: string; documentationOutcome: string | null }
    >();
    for (const row of rows) {
      for (const testCase of row.cases) {
        docStateByCaseId.set(testCase.id, {
          documentationSource: testCase.documentationSource,
          documentationOutcome: testCase.documentationOutcome,
        });
      }
    }

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
              needsManualReview: false,
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

      const documentableCandidate = (testCase: (typeof cases)[number]) => {
        const docState = docStateByCaseId.get(testCase.id);

        return {
          executionMode: testCase.executionMode,
          steps: testCase.steps,
          documentedLocale: testCase.documentedLocale,
          automationKey: testCase.automationKey ?? null,
          hasPendingProposal: testCase.pendingProposalId !== null,
          name: testCase.name,
          objective: testCase.objective,
          expectedResult: testCase.expectedResult,
          documentationSource: docState?.documentationSource ?? 'ingestion',
          documentationOutcome: docState?.documentationOutcome ?? null,
        };
      };

      const undocumentedCount = cases.filter((testCase) =>
        isCaseDocumentable(
          documentableCandidate(testCase),
          'undocumented',
          orgDefaultLocale,
        ),
      ).length;

      const staleLocaleCount = cases.filter((testCase) =>
        isCaseDocumentable(
          documentableCandidate(testCase),
          'stale-locale',
          orgDefaultLocale,
        ),
      ).length;

      const incompleteCount = cases.filter((testCase) =>
        isCaseDocumentable(
          documentableCandidate(testCase),
          'incomplete',
          orgDefaultLocale,
        ),
      ).length;

      return {
        ...view,
        cases,
        healthSummary,
        undocumentedCount,
        staleLocaleCount,
        incompleteCount,
      };
    });
  }
}
