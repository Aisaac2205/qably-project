import { Injectable } from '@nestjs/common';
import type { CaseStatus, RunSource, RunStatus } from '@qably/types';
import type { ApiKeyIdentity } from '../api-keys/api-keys.contracts';
import { err, ok, type Result } from '../../common/result';
import { PrismaService } from '../../prisma/prisma.service';
import type { RunError, RunView } from './runs.contracts';
import { deriveRunStatus } from './lib/derive-run-status';
import type { IngestCaseInput, IngestRunInput } from './runs.schemas';

const ALLOWED_SOURCES: readonly RunSource[] = ['api', 'github_actions'];

const RUN_SELECT = {
  id: true,
  projectId: true,
  organizationId: true,
  suiteId: true,
  name: true,
  status: true,
  source: true,
  externalId: true,
  startedAt: true,
  finishedAt: true,
  executedById: true,
  commitSha: true,
  commitMessage: true,
  commitAuthor: true,
} as const;

const CASE_SELECT = {
  id: true,
  testCaseId: true,
  name: true,
  suiteName: true,
  steps: true,
  expectedResult: true,
  status: true,
  position: true,
  recordedAt: true,
} as const;

interface RunRow {
  id: string;
  projectId: string;
  organizationId: string;
  suiteId: string;
  name: string;
  status: RunStatus;
  source: RunSource;
  externalId: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  executedById: string | null;
  commitSha: string | null;
  commitMessage: string | null;
  commitAuthor: string | null;
}

interface RunCaseRow {
  id: string;
  testCaseId: string | null;
  name: string;
  suiteName: string;
  steps: string[];
  expectedResult: string;
  status: CaseStatus;
  position: number;
  recordedAt: Date | null;
}

function isSourceAllowed(source: RunSource): boolean {
  return ALLOWED_SOURCES.includes(source);
}

function toView(run: RunRow, cases: RunCaseRow[]): RunView {
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
    cases: cases
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((row) => ({
        id: row.id,
        testCaseId: row.testCaseId,
        name: row.name,
        suiteName: row.suiteName,
        steps: row.steps,
        expectedResult: row.expectedResult,
        status: row.status,
        position: row.position,
        ...(row.recordedAt === null
          ? {}
          : { recordedAt: row.recordedAt.toISOString() }),
      })),
  };
}

@Injectable()
export class RunsService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(
    apiKey: ApiKeyIdentity,
    input: IngestRunInput,
  ): Promise<Result<RunView, RunError>> {
    if (!isSourceAllowed(input.source)) return err('source-not-allowed');

    const suite = await this.resolveSuite(apiKey, input);

    if (suite === null) return err('suite-not-found');

    const status = deriveRunStatus(
      input.cases.map((testCase) => testCase.status),
    );
    const startedAt =
      input.startedAt === undefined ? new Date() : new Date(input.startedAt);
    const finishedAt =
      input.finishedAt === undefined ? undefined : new Date(input.finishedAt);

    const { run, cases } = await this.prisma.$transaction(async (tx) => {
      const officialCases = await tx.testCase.findMany({
        where: {
          suiteId: suite.id,
          name: { in: input.cases.map((testCase) => testCase.name) },
        },
        select: { id: true, name: true },
      });
      const testCaseIdByName = new Map(
        officialCases.map((testCase) => [testCase.name, testCase.id]),
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

      const cases = (await tx.runCase.createManyAndReturn({
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
      })) as RunCaseRow[];

      return { run, cases };
    });

    return ok(toView(run, cases));
  }

  private resolveSuite(
    apiKey: ApiKeyIdentity,
    input: IngestRunInput,
  ): Promise<{ id: string; name: string } | null> {
    if (input.suiteId !== undefined) {
      return this.prisma.suite.findFirst({
        where: { id: input.suiteId, projectId: apiKey.projectId },
        select: { id: true, name: true },
      });
    }

    if (input.suiteName !== undefined) {
      return this.prisma.suite.findFirst({
        where: { name: input.suiteName, projectId: apiKey.projectId },
        select: { id: true, name: true },
      });
    }

    return Promise.resolve(null);
  }
}
