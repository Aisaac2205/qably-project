import { Injectable } from '@nestjs/common';
import type { RunSource } from '@qably/types';
import { humanizeTestName } from '@qably/test-naming';
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
    update: PrismaService['suite']['update'];
  };
  testCase: {
    findMany: PrismaService['testCase']['findMany'];
    createMany: PrismaService['testCase']['createMany'];
    update: PrismaService['testCase']['update'];
  };
}

interface RawCaseRef {
  name: string;
  className?: string;
  filePath?: string;
}

interface CaseReloadTx {
  runCase: {
    findMany: PrismaService['runCase']['findMany'];
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

    const { run, cases } = await this.prisma.$transaction(async (tx) => {
      const suite =
        knownSuite ??
        (await this.adoptSuiteByName(tx, apiKey, input.suiteName as string));

      const testCaseIdByName = await this.ensureOfficialCases(
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
      where: { name: suiteKey, projectId: apiKey.projectId, ingestionKey: null },
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

  private async ensureOfficialCases(
    tx: AdoptionTx,
    suiteId: string,
    projectId: string,
    cases: RawCaseRef[],
  ): Promise<Map<string, string>> {
    const refByKey = new Map<string, RawCaseRef>();
    for (const testCase of cases) {
      if (!refByKey.has(testCase.name)) refByKey.set(testCase.name, testCase);
    }
    const keys = [...refByKey.keys()];

    const matches = await tx.testCase.findMany({
      where: {
        suiteId,
        OR: [
          { automationKey: { in: keys } },
          {
            automationKey: null,
            executionMode: 'automated',
            name: { in: keys },
          },
        ],
      },
      select: { id: true, name: true, automationKey: true },
    });

    const resultByKey = new Map<string, string>();
    const legacyMatches: { id: string; name: string }[] = [];

    for (const match of matches) {
      if (match.automationKey !== null) {
        resultByKey.set(match.automationKey, match.id);
      } else if (keys.includes(match.name)) {
        legacyMatches.push({ id: match.id, name: match.name });
        resultByKey.set(match.name, match.id);
      }
    }

    if (legacyMatches.length > 0) {
      await Promise.all(
        legacyMatches.map((legacy) =>
          tx.testCase.update({
            where: { id: legacy.id },
            data: { automationKey: legacy.name },
          }),
        ),
      );
    }

    const missingKeys = keys.filter((key) => !resultByKey.has(key));

    if (missingKeys.length === 0) return resultByKey;

    const existingCases = await tx.testCase.findMany({
      where: { suiteId },
      select: { name: true },
    });
    const takenNames = new Set(existingCases.map((testCase) => testCase.name));

    const toCreate = missingKeys.map((key) => {
      const ref = refByKey.get(key) as RawCaseRef;
      const humanized = humanizeTestName({
        name: key,
        className: ref.className,
        filePath: ref.filePath,
      }).title;
      const candidateName = humanized.length > 0 ? humanized : key;
      const name = takenNames.has(candidateName) ? key : candidateName;
      takenNames.add(name);

      return {
        suiteId,
        projectId,
        name,
        state: 'draft' as const,
        executionMode: 'automated' as const,
        automationKey: key,
        ...(ref.className === undefined
          ? {}
          : { automationClassName: ref.className }),
        ...(ref.filePath === undefined
          ? {}
          : { automationFilePath: ref.filePath }),
      };
    });

    await tx.testCase.createMany({ data: toCreate, skipDuplicates: true });

    const created = await tx.testCase.findMany({
      where: { suiteId, automationKey: { in: missingKeys } },
      select: { id: true, automationKey: true },
    });

    for (const testCase of created) {
      if (testCase.automationKey !== null) {
        resultByKey.set(testCase.automationKey, testCase.id);
      }
    }

    return resultByKey;
  }
}
