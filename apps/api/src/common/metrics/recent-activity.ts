import type {
  DashboardActivityEntry,
  RunCaseCounts,
  RunSource,
  RunStatus,
} from '@qably/types';
import { rollUpStatus } from './run-status-rollup';

export const RECENT_ACTIVITY_CANDIDATE_LIMIT = 200;
export const RECENT_ACTIVITY_LIMIT = 4;

export interface RecentActivityRunRow {
  id: string;
  projectId: string;
  projectName: string;
  suiteId: string;
  suiteName: string;
  name: string;
  source: RunSource;
  status: RunStatus;
  startedAt: Date;
  commitSha: string | null;
  commitMessage: string | null;
  commitAuthor: string | null;
  caseCounts: RunCaseCounts;
}

function groupKey(row: RecentActivityRunRow): string {
  return `${row.projectId}::${row.commitSha ?? row.id}`;
}

export function selectLatestRunPerSuite(
  rows: readonly RecentActivityRunRow[],
): RecentActivityRunRow[] {
  const bySuite = new Map<string, RecentActivityRunRow>();

  for (const row of rows) {
    const existing = bySuite.get(row.suiteId);
    const isNewer =
      existing === undefined ||
      row.startedAt.getTime() > existing.startedAt.getTime() ||
      (row.startedAt.getTime() === existing.startedAt.getTime() &&
        row.id > existing.id);

    if (isNewer) bySuite.set(row.suiteId, row);
  }

  return [...bySuite.values()];
}

function buildEntry(
  groupRows: readonly RecentActivityRunRow[],
): DashboardActivityEntry {
  const latestPerSuite = selectLatestRunPerSuite(groupRows);
  const anchor = [...latestPerSuite].sort(
    (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
  )[0];

  let status: RunStatus = 'pass';
  let casesPassed = 0;
  let casesTotal = 0;
  let commitMessage: string | undefined;
  let commitAuthor: string | undefined;

  for (const row of latestPerSuite) {
    status = rollUpStatus(status, row.status);
    casesPassed += row.caseCounts.pass;
    casesTotal += row.caseCounts.total;
    if (commitMessage === undefined && row.commitMessage !== null) {
      commitMessage = row.commitMessage;
    }
    if (commitAuthor === undefined && row.commitAuthor !== null) {
      commitAuthor = row.commitAuthor;
    }
  }

  const base = {
    projectId: anchor.projectId,
    projectName: anchor.projectName,
    status,
    source: anchor.source,
    occurredAt: anchor.startedAt.toISOString(),
    casesPassed,
    casesTotal,
  };

  if (anchor.commitSha !== null) {
    return {
      ...base,
      kind: 'commit',
      commitSha: anchor.commitSha,
      suiteCount: latestPerSuite.length,
      ...(commitMessage === undefined ? {} : { commitMessage }),
      ...(commitAuthor === undefined ? {} : { commitAuthor }),
    };
  }

  return {
    ...base,
    kind: 'run',
    runId: anchor.id,
    runName: anchor.name,
    suiteName: anchor.suiteName,
  };
}

export function buildRecentActivity(
  rows: readonly RecentActivityRunRow[],
  limit: number = RECENT_ACTIVITY_LIMIT,
): DashboardActivityEntry[] {
  const groups = new Map<string, RecentActivityRunRow[]>();

  for (const row of rows) {
    const key = groupKey(row);
    const bucket = groups.get(key);
    if (bucket === undefined) {
      groups.set(key, [row]);
    } else {
      bucket.push(row);
    }
  }

  return [...groups.values()]
    .map(buildEntry)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, limit);
}
