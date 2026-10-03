import type { CiRunStatus, CiRunSummaryRecord, RunSource } from '@qably/types';

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
