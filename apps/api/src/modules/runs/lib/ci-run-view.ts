import type {
  CiRunJobRunRecord,
  CiRunStatus,
  CiRunSummaryRecord,
  RunSource,
  RunStatus,
} from '@qably/types';

export const CI_RUN_SELECT = {
  id: true,
  projectId: true,
  source: true,
  externalId: true,
  workflowName: true,
  runNumber: true,
  runAttempt: true,
  branch: true,
  headRef: true,
  actor: true,
  eventName: true,
  serverUrl: true,
  repository: true,
  commitSha: true,
  commitMessage: true,
  commitAuthor: true,
  startedAt: true,
  lastReportedAt: true,
} as const;

export const CI_RUN_JOB_RUN_SELECT = {
  id: true,
  suiteId: true,
  name: true,
  status: true,
  startedAt: true,
  ciJobKey: true,
  reportExternalId: true,
  suite: { select: { name: true } },
} as const;

export interface CiRunRow {
  id: string;
  projectId: string;
  source: RunSource;
  externalId: string;
  workflowName: string | null;
  runNumber: number | null;
  runAttempt: number | null;
  branch: string | null;
  headRef: string | null;
  actor: string | null;
  eventName: string | null;
  serverUrl: string | null;
  repository: string | null;
  commitSha: string | null;
  commitMessage: string | null;
  commitAuthor: string | null;
  startedAt: Date;
  lastReportedAt: Date;
}

export interface CiRunJobRunRow {
  id: string;
  suiteId: string;
  name: string;
  status: RunStatus;
  startedAt: Date;
  ciJobKey: string | null;
  reportExternalId: string | null;
  suite: { name: string };
}

export function toCiRunSummary(
  row: CiRunRow,
  status: CiRunStatus,
): CiRunSummaryRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    source: row.source,
    externalId: row.externalId,
    status,
    startedAt: row.startedAt.toISOString(),
    lastReportedAt: row.lastReportedAt.toISOString(),
    ...(row.workflowName === null ? {} : { workflowName: row.workflowName }),
    ...(row.runNumber === null ? {} : { runNumber: row.runNumber }),
    ...(row.runAttempt === null ? {} : { runAttempt: row.runAttempt }),
    ...(row.branch === null ? {} : { branch: row.branch }),
    ...(row.headRef === null ? {} : { headRef: row.headRef }),
    ...(row.actor === null ? {} : { actor: row.actor }),
    ...(row.eventName === null ? {} : { eventName: row.eventName }),
    ...(row.serverUrl === null ? {} : { serverUrl: row.serverUrl }),
    ...(row.repository === null ? {} : { repository: row.repository }),
    ...(row.commitSha === null ? {} : { commitSha: row.commitSha }),
    ...(row.commitMessage === null ? {} : { commitMessage: row.commitMessage }),
    ...(row.commitAuthor === null ? {} : { commitAuthor: row.commitAuthor }),
  };
}

export function toCiRunJobRun(row: CiRunJobRunRow): CiRunJobRunRecord {
  return {
    id: row.id,
    suiteId: row.suiteId,
    suiteName: row.suite.name,
    name: row.name,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    ...(row.ciJobKey === null ? {} : { ciJobKey: row.ciJobKey }),
    ...(row.reportExternalId === null
      ? {}
      : { reportExternalId: row.reportExternalId }),
  };
}
