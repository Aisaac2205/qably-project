import type {
  CaseStatus,
  ExecutionMode,
  RunCaseOfficialCase,
  RunSource,
  RunStatus,
} from '@qably/types';
import type { RunView } from '../runs.contracts';
import { parseCatalogSnapshot } from './catalog-snapshot';

export const RUN_SELECT = {
  id: true,
  projectId: true,
  organizationId: true,
  suiteId: true,
  name: true,
  status: true,
  source: true,
  externalId: true,
  reportExternalId: true,
  startedAt: true,
  finishedAt: true,
  executedById: true,
  commitSha: true,
  commitMessage: true,
  commitAuthor: true,
  ciRunId: true,
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
  className: true,
  filePath: true,
  durationMs: true,
  failureType: true,
  failureMessage: true,
  failureDetails: true,
  skipReason: true,
} as const;

export const CASE_READ_SELECT = {
  ...CASE_SELECT,
  catalogSnapshot: true,
  testCase: {
    select: {
      id: true,
      suiteId: true,
      name: true,
      steps: true,
      expectedResult: true,
      executionMode: true,
      automationKey: true,
      automationClassName: true,
      automationFilePath: true,
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
  reportExternalId: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  executedById: string | null;
  commitSha: string | null;
  commitMessage: string | null;
  commitAuthor: string | null;
  ciRunId: string | null;
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
  className?: string | null;
  filePath?: string | null;
  durationMs?: number | null;
  failureType?: string | null;
  failureMessage?: string | null;
  failureDetails?: string | null;
  skipReason?: string | null;
  /** Untyped JSON; read it only through `parseCatalogSnapshot`. */
  catalogSnapshot?: unknown;
  testCase?: {
    id: string;
    suiteId: string;
    name: string;
    steps: string[];
    expectedResult: string;
    executionMode: ExecutionMode;
    automationKey: string | null;
    automationClassName: string | null;
    automationFilePath: string | null;
    currentVersion: { version: number } | null;
  } | null;
}

/**
 * The live case supplies identity, links and automation metadata. The content
 * (name, steps, expected result, version) is what the run executed, read from
 * the snapshot; a row without a usable snapshot reads the live content, as every
 * row did before snapshots existed.
 */
function toOfficialCase(row: RunCaseRow): RunCaseOfficialCase | null {
  const live = row.testCase;

  if (live === undefined || live === null) return null;

  const liveVersion = live.currentVersion?.version ?? null;
  const executed = parseCatalogSnapshot(row.catalogSnapshot) ?? {
    name: live.name,
    steps: live.steps,
    expectedResult: live.expectedResult,
    version: liveVersion,
  };

  return {
    id: live.id,
    suiteId: live.suiteId,
    version: liveVersion,
    executedVersion: executed.version,
    name: executed.name,
    steps: executed.steps,
    expectedResult: executed.expectedResult,
    documented: live.steps.length > 0 || live.expectedResult !== '',
    executionMode: live.executionMode,
    ...(live.automationKey === null
      ? {}
      : { automationKey: live.automationKey }),
    ...(live.automationClassName === null
      ? {}
      : { automationClassName: live.automationClassName }),
    ...(live.automationFilePath === null
      ? {}
      : { automationFilePath: live.automationFilePath }),
  };
}

export function toRunView(
  run: RunRow,
  cases: RunCaseRow[],
  delta: RunView['delta'] = null,
): RunView {
  return {
    delta,
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
    ...(run.ciRunId === null ? {} : { ciRunId: run.ciRunId }),
    cases: cases
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((row) => ({
        id: row.id,
        testCaseId: row.testCaseId,
        officialCase: toOfficialCase(row),
        name: row.name,
        suiteName: row.suiteName,
        steps: row.steps,
        expectedResult: row.expectedResult,
        status: row.status,
        position: row.position,
        ...(row.recordedAt === null
          ? {}
          : { recordedAt: row.recordedAt.toISOString() }),
        ...(row.className === undefined || row.className === null
          ? {}
          : { className: row.className }),
        ...(row.filePath === undefined || row.filePath === null
          ? {}
          : { filePath: row.filePath }),
        ...(row.durationMs === undefined || row.durationMs === null
          ? {}
          : { durationMs: row.durationMs }),
        ...(row.failureType === undefined || row.failureType === null
          ? {}
          : { failureType: row.failureType }),
        ...(row.failureMessage === undefined || row.failureMessage === null
          ? {}
          : { failureMessage: row.failureMessage }),
        ...(row.failureDetails === undefined || row.failureDetails === null
          ? {}
          : { failureDetails: row.failureDetails }),
        ...(row.skipReason === undefined || row.skipReason === null
          ? {}
          : { skipReason: row.skipReason }),
      })),
  };
}
