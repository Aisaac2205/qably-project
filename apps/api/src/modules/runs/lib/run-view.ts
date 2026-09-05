import type { CaseStatus, RunSource, RunStatus } from '@qably/types';
import type { RunView } from '../runs.contracts';

export const RUN_SELECT = {
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

export const RUN_LIST_SELECT = {
  ...RUN_SELECT,
  suite: { select: { name: true } },
} as const;

export const CASE_SELECT = {
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

export const CASE_READ_SELECT = {
  ...CASE_SELECT,
  testCase: {
    select: {
      id: true,
      suiteId: true,
      steps: true,
      expectedResult: true,
      currentVersion: { select: { version: true } },
    },
  },
} as const;

export interface RunRow {
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

export interface RunListRow extends RunRow {
  suite: { name: string };
}

export interface RunCaseRow {
  id: string;
  testCaseId: string | null;
  name: string;
  suiteName: string;
  steps: string[];
  expectedResult: string;
  status: CaseStatus;
  position: number;
  recordedAt: Date | null;
  testCase?: {
    id: string;
    suiteId: string;
    steps: string[];
    expectedResult: string;
    currentVersion: { version: number } | null;
  } | null;
}

export function toRunView(run: RunRow, cases: RunCaseRow[]): RunView {
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
        officialCase:
          row.testCase === undefined || row.testCase === null
            ? null
            : {
                id: row.testCase.id,
                suiteId: row.testCase.suiteId,
                version: row.testCase.currentVersion?.version ?? null,
                steps: row.testCase.steps,
                expectedResult: row.testCase.expectedResult,
              },
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
