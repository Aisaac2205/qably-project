import { Injectable } from '@nestjs/common';
import type { RunSource } from '@qably/types';
import { humanizeTestName } from '@qably/test-naming';
import type { ApiKeyIdentity } from '../api-keys/api-keys.contracts';
import { err, ok, type Result } from '../../common/result';
import { NotificationsPublisher } from '../notifications/notifications.publisher';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportBatchService } from './report-batch.service';
import type { RunError, RunView } from './runs.contracts';
import { deriveRunStatus } from './lib/derive-run-status';
import {
  findCaseIdentityCollisions,
  findLegacyKeyCollisions,
  resolveCaseIdentityKey,
} from './lib/case-identity';
import { normalizeAutomationKeyForMatch } from './lib/normalize-automation-key';
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

interface SuiteCaseRow {
  id: string;
  name: string;
  automationKey: string | null;
  automationClassName?: string | null;
  automationFilePath?: string | null;
  executionMode?: string;
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
    private readonly reportBatch: ReportBatchService,
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

      const testCaseIdByIdentity = await this.ensureOfficialCases(
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

  private async ensureOfficialCases(
    tx: AdoptionTx,
    suiteId: string,
    projectId: string,
    cases: RawCaseRef[],
  ): Promise<Map<string, string>> {
    const collidingKeys = new Set(
      findCaseIdentityCollisions(cases).map((collision) => collision.key),
    );

    const refByKey = new Map<string, RawCaseRef>();
    for (const testCase of cases) {
      const identityKey = resolveCaseIdentityKey(testCase);
      if (collidingKeys.has(identityKey)) continue;
      if (!refByKey.has(identityKey)) refByKey.set(identityKey, testCase);
    }
    const keys = [...refByKey.keys()];

    const suiteCases = (await tx.testCase.findMany({
      where: { suiteId },
      select: {
        id: true,
        name: true,
        automationKey: true,
        automationClassName: true,
        automationFilePath: true,
        executionMode: true,
      },
    })) as SuiteCaseRow[];

    const byExactKey = new Map<string, SuiteCaseRow>();
    const byNormalizedKey = new Map<string, SuiteCaseRow>();
    const ambiguousNormalizedKeys = new Set<string>();
    const byExactName = new Map<string, SuiteCaseRow>();
    const byNormalizedName = new Map<string, SuiteCaseRow>();
    const ambiguousNormalizedNames = new Set<string>();
    const takenNames = new Set<string>();

    for (const row of suiteCases) {
      takenNames.add(row.name);

      if (row.automationKey !== null) {
        byExactKey.set(row.automationKey, row);
        const normalizedKey = normalizeAutomationKeyForMatch(row.automationKey);
        if (byNormalizedKey.has(normalizedKey)) {
          ambiguousNormalizedKeys.add(normalizedKey);
        } else {
          byNormalizedKey.set(normalizedKey, row);
        }
      }

      byExactName.set(row.name, row);
      const normalizedName = normalizeAutomationKeyForMatch(row.name);
      if (byNormalizedName.has(normalizedName)) {
        ambiguousNormalizedNames.add(normalizedName);
      } else {
        byNormalizedName.set(normalizedName, row);
      }
    }

    interface CaseBackfillPatch {
      automationKey?: string;
      automationFilePath?: string;
      automationClassName?: string;
    }

    const ambiguousLegacyKeys = new Set(
      findLegacyKeyCollisions(cases).map((collision) => collision.key),
    );

    const resultByKey = new Map<string, string>();
    const updatesById = new Map<string, CaseBackfillPatch>();
    const missingKeys: string[] = [];

    for (const key of keys) {
      const ref = refByKey.get(key) as RawCaseRef;
      const legacyKey = ref.name;
      const usesCompositeIdentity = key !== legacyKey;
      const legacyIsAmbiguous = ambiguousLegacyKeys.has(legacyKey);
      const normalized = normalizeAutomationKeyForMatch(key);
      const legacyNormalized = normalizeAutomationKeyForMatch(legacyKey);

      let match: SuiteCaseRow | undefined;
      let needsKeyBackfill = false;
      let claimsLegacyRow = false;

      if (usesCompositeIdentity) {
        match = byExactKey.get(key);
        if (match === undefined && !ambiguousNormalizedKeys.has(normalized)) {
          match = byNormalizedKey.get(normalized);
        }
      } else if (!legacyIsAmbiguous) {
        match = byExactKey.get(key);
        if (match === undefined && !ambiguousNormalizedKeys.has(normalized)) {
          match = byNormalizedKey.get(normalized);
        }
      }

      if (match === undefined && usesCompositeIdentity && !legacyIsAmbiguous) {
        match = byExactKey.get(legacyKey);
        if (
          match === undefined &&
          !ambiguousNormalizedKeys.has(legacyNormalized)
        ) {
          match = byNormalizedKey.get(legacyNormalized);
        }
        if (match !== undefined) claimsLegacyRow = true;
      }

      if (match === undefined && !legacyIsAmbiguous) {
        const nameMatch =
          byExactName.get(legacyKey) ??
          (ambiguousNormalizedNames.has(legacyNormalized)
            ? undefined
            : byNormalizedName.get(legacyNormalized));
        if (
          nameMatch !== undefined &&
          nameMatch.automationKey === null &&
          nameMatch.executionMode === 'automated'
        ) {
          match = nameMatch;
          needsKeyBackfill = true;
        }
      }

      if (match === undefined) {
        if (legacyIsAmbiguous && !usesCompositeIdentity) continue;
        missingKeys.push(key);
        continue;
      }

      resultByKey.set(key, match.id);

      const patch: CaseBackfillPatch = {};
      if (needsKeyBackfill || claimsLegacyRow) patch.automationKey = key;
      if (
        (match.automationFilePath ?? null) === null &&
        ref.filePath !== undefined
      ) {
        patch.automationFilePath = ref.filePath;
      }
      if (
        (match.automationClassName ?? null) === null &&
        ref.className !== undefined
      ) {
        patch.automationClassName = ref.className;
      }

      if (Object.keys(patch).length > 0) {
        updatesById.set(match.id, {
          ...(updatesById.get(match.id) ?? {}),
          ...patch,
        });
      }
    }

    if (updatesById.size > 0) {
      await Promise.all(
        [...updatesById.entries()].map(async ([id, data]) => {
          try {
            await tx.testCase.update({ where: { id }, data });
          } catch (error) {
            if (!isUniqueViolation(error)) throw error;
          }
        }),
      );
    }

    if (missingKeys.length === 0) return resultByKey;

    const toCreate = missingKeys.map((key) => {
      const ref = refByKey.get(key) as RawCaseRef;
      const humanized = humanizeTestName({
        name: ref.name,
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
