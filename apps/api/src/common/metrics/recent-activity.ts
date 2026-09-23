import type {
  DashboardActivityEntry,
  RunSource,
  RunStatus,
} from '@qably/types';
import { rollUpStatus } from './run-status-rollup';

export const RECENT_ACTIVITY_LIMIT = 4;

export interface ActivityAggregateRow {
  projectId: string;
  activityKey: string;
  commitSha: string | null;
  projectName: string;
  suiteCount: number;
  statuses: readonly RunStatus[];
  anchorRunId: string;
  anchorRunName: string;
  anchorSuiteName: string;
  anchorSource: RunSource;
  anchorStartedAt: Date;
  anchorCommitMessage: string | null;
  anchorCommitAuthor: string | null;
  casesPassed: number;
  casesTotal: number;
}

export function rollUpStatuses(statuses: readonly RunStatus[]): RunStatus {
  return statuses.reduce<RunStatus>(
    (current, incoming) => rollUpStatus(current, incoming),
    'pass',
  );
}

export function buildActivityEntry(
  row: ActivityAggregateRow,
): DashboardActivityEntry {
  const base = {
    projectId: row.projectId,
    projectName: row.projectName,
    status: rollUpStatuses(row.statuses),
    source: row.anchorSource,
    occurredAt: row.anchorStartedAt.toISOString(),
    casesPassed: row.casesPassed,
    casesTotal: row.casesTotal,
  };

  if (row.commitSha !== null) {
    return {
      ...base,
      kind: 'commit',
      commitSha: row.commitSha,
      suiteCount: row.suiteCount,
      ...(row.anchorCommitMessage === null
        ? {}
        : { commitMessage: row.anchorCommitMessage }),
      ...(row.anchorCommitAuthor === null
        ? {}
        : { commitAuthor: row.anchorCommitAuthor }),
    };
  }

  return {
    ...base,
    kind: 'run',
    runId: row.anchorRunId,
    runName: row.anchorRunName,
    suiteName: row.anchorSuiteName,
  };
}

export function buildRecentActivityFromAggregates(
  rows: readonly ActivityAggregateRow[],
): DashboardActivityEntry[] {
  return rows.map(buildActivityEntry);
}
