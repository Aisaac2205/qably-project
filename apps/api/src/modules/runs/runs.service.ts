import { Injectable } from '@nestjs/common';
import type { RunSource } from '@qably/types';
import type { ApiKeyIdentity } from '../api-keys/api-keys.contracts';
import { err, ok, type Result } from '../../common/result';
import { PrismaService } from '../../prisma/prisma.service';
import type { RunError, RunView } from './runs.contracts';
import { deriveRunStatus } from './lib/derive-run-status';
import {
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

    return ok(toRunView(run, cases));
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
