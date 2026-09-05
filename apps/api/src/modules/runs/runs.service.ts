import { Injectable } from '@nestjs/common';
import type { RunSource } from '@qably/types';
import type { ApiKeyIdentity } from '../api-keys/api-keys.contracts';
import { err, ok, type Result } from '../../common/result';
import { NotificationsPublisher } from '../notifications/notifications.publisher';
import { PrismaService } from '../../prisma/prisma.service';
import type { RunError, RunView } from './runs.contracts';
import { deriveRunStatus } from './lib/derive-run-status';
import {
  CASE_READ_SELECT,
  CASE_SELECT,
  RUN_SELECT,
  toRunView,
  type RunCaseRow,
} from './lib/run-view';
import type { IngestCaseInput, IngestRunInput } from './runs.schemas';

const ALLOWED_SOURCES: readonly RunSource[] = ['api', 'github_actions'];
const UNIQUE_VIOLATION = 'P2002';

function isSourceAllowed(source: RunSource): boolean {
  return ALLOWED_SOURCES.includes(source);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

interface SuiteRef {
  id: string;
  name: string;
}

interface AdoptionTx {
  suite: {
    findFirst: PrismaService['suite']['findFirst'];
    create: PrismaService['suite']['create'];
    findFirstOrThrow: PrismaService['suite']['findFirstOrThrow'];
  };
  testCase: {
    findMany: PrismaService['testCase']['findMany'];
    createMany: PrismaService['testCase']['createMany'];
  };
}

@Injectable()
export class RunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsPublisher,
  ) {}

  async ingest(
    apiKey: ApiKeyIdentity,
    input: IngestRunInput,
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

    const { run } = await this.prisma.$transaction(async (tx) => {
      const suite =
        knownSuite ??
        (await this.adoptSuiteByName(tx, apiKey, input.suiteName as string));

      const testCaseIdByName = await this.ensureOfficialCases(
        tx,
        suite.id,
        apiKey.projectId,
        input.cases.map((testCase) => testCase.name),
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
          testCaseId: testCaseIdByName.get(testCase.name) ?? null,
          name: testCase.name,
          suiteName: testCase.suiteName ?? suite.name,
          steps: testCase.steps,
          expectedResult: testCase.expectedResult,
          status: testCase.status,
          position: index,
          ...(testCase.recordedAt === undefined
            ? {}
            : { recordedAt: new Date(testCase.recordedAt) }),
        })),
        select: CASE_SELECT,
      });

      return { run };
    });

    const cases = (await this.prisma.runCase.findMany({
      where: { runId: run.id },
      select: CASE_READ_SELECT,
      orderBy: { position: 'asc' },
    })) as RunCaseRow[];

    if (status === 'fail' || status === 'pass') {
      await this.notifications.publish({
        eventType: status === 'fail' ? 'run_failed' : 'run_completed',
        organizationId: apiKey.organizationId,
        severity: status === 'fail' ? 'high' : 'low',
        payload: { runName: run.name, suiteName: cases[0]?.suiteName ?? '' },
        dedupeKey: `${status === 'fail' ? 'run_failed' : 'run_completed'}:${run.id}`,
        projectId: apiKey.projectId,
        runId: run.id,
      });
    }

    return ok(toRunView(run, cases));
  }

  private async adoptSuiteByName(
    tx: AdoptionTx,
    apiKey: ApiKeyIdentity,
    suiteName: string,
  ): Promise<SuiteRef> {
    const existing = await tx.suite.findFirst({
      where: { name: suiteName, projectId: apiKey.projectId },
      select: { id: true, name: true },
    });

    if (existing !== null) return existing;

    try {
      return await tx.suite.create({
        data: {
          projectId: apiKey.projectId,
          organizationId: apiKey.organizationId,
          name: suiteName,
        },
        select: { id: true, name: true },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      return tx.suite.findFirstOrThrow({
        where: { name: suiteName, projectId: apiKey.projectId },
        select: { id: true, name: true },
      });
    }
  }

  private async ensureOfficialCases(
    tx: AdoptionTx,
    suiteId: string,
    projectId: string,
    caseNames: string[],
  ): Promise<Map<string, string>> {
    const uniqueNames = [...new Set(caseNames)];
    const existing = await tx.testCase.findMany({
      where: { suiteId, name: { in: uniqueNames } },
      select: { id: true, name: true },
    });

    const existingNames = new Set(existing.map((testCase) => testCase.name));
    const missingNames = uniqueNames.filter((name) => !existingNames.has(name));

    if (missingNames.length === 0) {
      return new Map(existing.map((testCase) => [testCase.name, testCase.id]));
    }

    await tx.testCase.createMany({
      data: missingNames.map((name) => ({
        suiteId,
        projectId,
        name,
        state: 'draft' as const,
      })),
      skipDuplicates: true,
    });

    const all = await tx.testCase.findMany({
      where: { suiteId, name: { in: uniqueNames } },
      select: { id: true, name: true },
    });

    return new Map(all.map((testCase) => [testCase.name, testCase.id]));
  }
}
