import { Injectable, Logger } from '@nestjs/common';
import type { RunSource } from '@qably/types';
import type { ApiKeyIdentity } from '../api-keys/api-keys.contracts';
import { err, ok, type Result } from '../../common/result';
import { NotificationsPublisher } from '../notifications/notifications.publisher';
import { isUniqueViolation } from '../../prisma/is-unique-violation';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OfficialCaseReconciler,
  type AdoptionTx,
} from './official-case-reconciler';
import { ReportBatchService } from './report-batch.service';
import type { RunError, RunView } from './runs.contracts';
import { deriveRunStatus } from './lib/derive-run-status';
import { resolveCaseIdentityKey } from './lib/case-identity';
import {
  CASE_READ_SELECT,
  CASE_SELECT,
  RUN_SELECT,
  toRunView,
  type RunCaseRow,
} from './lib/run-view';
import type { IngestCaseInput, IngestRunInput } from './runs.schemas';

const ALLOWED_SOURCES: readonly RunSource[] = ['api', 'github_actions'];

function isSourceAllowed(source: RunSource): boolean {
  return ALLOWED_SOURCES.includes(source);
}

interface SuiteRef {
  id: string;
  name: string;
}

interface CaseReloadTx {
  runCase: {
    findMany: PrismaService['runCase']['findMany'];
  };
}

@Injectable()
export class RunsService {
  private readonly logger = new Logger(RunsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsPublisher,
    private readonly reportBatch: ReportBatchService,
    private readonly officialCaseReconciler: OfficialCaseReconciler,
  ) {}

  async ingest(
    apiKey: ApiKeyIdentity,
    input: IngestRunInput,
    reportSize = 1,
  ): Promise<Result<RunView, RunError>> {
    if (!isSourceAllowed(input.source)) return err('source-not-allowed');

    let knownSuite: SuiteRef | null = null;

    if (input.suiteId !== undefined) {
      knownSuite = await this.prisma.suite.findFirst({
        where: { id: input.suiteId, projectId: apiKey.projectId },
        select: { id: true, name: true },
      });

      if (knownSuite === null) return err('suite-not-found');
    }

    const status = deriveRunStatus(
      input.cases.map((testCase) => testCase.status),
    );
    const startedAt =
      input.startedAt === undefined ? new Date() : new Date(input.startedAt);
    const finishedAt =
      input.finishedAt === undefined ? undefined : new Date(input.finishedAt);
    const reportExternalId = input.reportExternalId ?? input.externalId;

    const { run, cases } = await this.prisma.$transaction(async (tx) => {
      const suite =
        knownSuite ??
        (await this.adoptSuiteByName(tx, apiKey, input.suiteName as string));

      const testCaseIdByIdentity = await this.officialCaseReconciler.reconcile(
        tx,
        suite.id,
        apiKey.projectId,
        input.cases.map((testCase) => ({
          name: testCase.name,
          className: testCase.className,
          filePath: testCase.filePath,
        })),
      );

      const run = await tx.run.upsert({
        where: {
          projectId_source_externalId: {
            projectId: apiKey.projectId,
            source: input.source,
            externalId: input.externalId,
          },
        },
        create: {
          projectId: apiKey.projectId,
          organizationId: apiKey.organizationId,
          suiteId: suite.id,
          name: input.name,
          status,
          source: input.source,
          externalId: input.externalId,
          reportExternalId,
          startedAt,
          ...(finishedAt === undefined ? {} : { finishedAt }),
          ...(input.commitSha === undefined
            ? {}
            : { commitSha: input.commitSha }),
          ...(input.commitMessage === undefined
            ? {}
            : { commitMessage: input.commitMessage }),
          ...(input.commitAuthor === undefined
            ? {}
            : { commitAuthor: input.commitAuthor }),
        },
        update: {
          suiteId: suite.id,
          name: input.name,
          status,
          reportExternalId,
          ...(input.startedAt === undefined ? {} : { startedAt }),
          ...(finishedAt === undefined ? {} : { finishedAt }),
          ...(input.commitSha === undefined
            ? {}
            : { commitSha: input.commitSha }),
          ...(input.commitMessage === undefined
            ? {}
            : { commitMessage: input.commitMessage }),
          ...(input.commitAuthor === undefined
            ? {}
            : { commitAuthor: input.commitAuthor }),
        },
        select: RUN_SELECT,
      });

      await tx.runCase.deleteMany({ where: { runId: run.id } });

      await tx.runCase.createManyAndReturn({
        data: input.cases.map((testCase: IngestCaseInput, index: number) => ({
          runId: run.id,
          testCaseId:
            testCaseIdByIdentity.get(resolveCaseIdentityKey(testCase)) ?? null,
          name: testCase.name,
          suiteName: testCase.suiteName ?? suite.name,
          steps: testCase.steps,
          expectedResult: testCase.expectedResult,
          status: testCase.status,
          position: index,
          ...(testCase.recordedAt === undefined
            ? {}
            : { recordedAt: new Date(testCase.recordedAt) }),
          ...(testCase.className === undefined
            ? {}
            : { className: testCase.className }),
          ...(testCase.filePath === undefined
            ? {}
            : { filePath: testCase.filePath }),
          ...(testCase.durationMs === undefined
            ? {}
            : { durationMs: testCase.durationMs }),
          ...(testCase.failureType === undefined
            ? {}
            : { failureType: testCase.failureType }),
          ...(testCase.failureMessage === undefined
            ? {}
            : { failureMessage: testCase.failureMessage }),
          ...(testCase.failureDetails === undefined
            ? {}
            : { failureDetails: testCase.failureDetails }),
          ...(testCase.skipReason === undefined
            ? {}
            : { skipReason: testCase.skipReason }),
        })),
        select: CASE_SELECT,
      });

      const cases = await this.reloadCases(tx, run.id);

      return { run, cases };
    });

    if (status === 'fail' || status === 'pass') {
      const suiteName = cases[0]?.suiteName ?? '';

      if (reportSize <= 1) {
        await this.notifications.publish({
          eventType: status === 'fail' ? 'run_failed' : 'run_completed',
          organizationId: apiKey.organizationId,
          severity: status === 'fail' ? 'high' : 'low',
          payload: { runName: run.name, suiteName },
          dedupeKey: `${status === 'fail' ? 'run_failed' : 'run_completed'}:${run.id}`,
          projectId: apiKey.projectId,
          runId: run.id,
        });
      } else {
        await this.reportBatch.recordAndMaybePublish({
          organizationId: apiKey.organizationId,
          projectId: apiKey.projectId,
          source: input.source,
          reportExternalId,
          reportSize,
          runId: run.id,
          suiteName,
          status,
        });
      }
    }

    return ok(toRunView(run, cases));
  }

  private async reloadCases(
    tx: CaseReloadTx,
    runId: string,
  ): Promise<RunCaseRow[]> {
    return await tx.runCase.findMany({
      where: { runId },
      select: CASE_READ_SELECT,
      orderBy: { position: 'asc' },
    });
  }

  private async adoptSuiteByName(
    tx: AdoptionTx,
    apiKey: ApiKeyIdentity,
    suiteKey: string,
  ): Promise<SuiteRef> {
    const byKey = await tx.suite.findFirst({
      where: { ingestionKey: suiteKey, projectId: apiKey.projectId },
      select: { id: true, name: true },
    });

    if (byKey !== null) return byKey;

    const legacy = await tx.suite.findFirst({
      where: {
        name: suiteKey,
        projectId: apiKey.projectId,
        ingestionKey: null,
      },
      select: { id: true, name: true },
    });

    if (legacy !== null) {
      await tx.suite.update({
        where: { id: legacy.id },
        data: { ingestionKey: suiteKey },
      });
      return legacy;
    }

    try {
      return await tx.suite.create({
        data: {
          projectId: apiKey.projectId,
          organizationId: apiKey.organizationId,
          name: suiteKey,
          ingestionKey: suiteKey,
        },
        select: { id: true, name: true },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      return tx.suite.findFirstOrThrow({
        where: { ingestionKey: suiteKey, projectId: apiKey.projectId },
        select: { id: true, name: true },
      });
    }
  }
}
