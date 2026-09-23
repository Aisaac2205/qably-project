import type { CiCommitActivityRecord, RunStatus } from '@qably/types';
import { rollUpStatus } from './run-status-rollup';

export const RECENT_CI_COMMITS_LIMIT = 4;

const SHORT_SHA_LENGTH = 7;

export interface CiCommitRunRow {
  commitSha: string;
  commitMessage: string | null;
  commitAuthor: string | null;
  status: RunStatus;
  startedAt: Date;
}

export function buildCiCommitActivity(
  rows: readonly CiCommitRunRow[],
): CiCommitActivityRecord[] {
  const byCommit = new Map<string, CiCommitActivityRecord>();

  for (const row of rows) {
    const existing = byCommit.get(row.commitSha);
    const passed = row.status === 'pass' ? 1 : 0;

    if (existing === undefined) {
      byCommit.set(row.commitSha, {
        commitSha: row.commitSha,
        shortSha: row.commitSha.slice(0, SHORT_SHA_LENGTH),
        status: row.status,
        lastRunAt: row.startedAt.toISOString(),
        runCount: 1,
        passedRunCount: passed,
        ...(row.commitMessage === null
          ? {}
          : { commitMessage: row.commitMessage }),
        ...(row.commitAuthor === null
          ? {}
          : { commitAuthor: row.commitAuthor }),
      });
      continue;
    }

    const lastRunAt = row.startedAt.toISOString();

    byCommit.set(row.commitSha, {
      ...existing,
      status: rollUpStatus(existing.status, row.status),
      lastRunAt:
        lastRunAt > existing.lastRunAt ? lastRunAt : existing.lastRunAt,
      runCount: existing.runCount + 1,
      passedRunCount: existing.passedRunCount + passed,
      ...(existing.commitMessage === undefined && row.commitMessage !== null
        ? { commitMessage: row.commitMessage }
        : {}),
      ...(existing.commitAuthor === undefined && row.commitAuthor !== null
        ? { commitAuthor: row.commitAuthor }
        : {}),
    });
  }

  return [...byCommit.values()].sort((a, b) =>
    b.lastRunAt.localeCompare(a.lastRunAt),
  );
}
