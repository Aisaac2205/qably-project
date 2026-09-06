import type { RunSource, RunStatus, SuiteMetricsEntry } from '@qably/types';

export const SUITE_METRICS_TREND_LIMIT = 10;

export interface RankedRunRow {
  id: string;
  suiteId: string;
  status: RunStatus;
  source: RunSource;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface SuiteRef {
  id: string;
  name: string;
}

export function buildSuiteMetrics(
  suites: readonly SuiteRef[],
  rankedRuns: readonly RankedRunRow[],
  passRateByRunId: ReadonlyMap<string, number>,
): SuiteMetricsEntry[] {
  const requested = new Set(suites.map((suite) => suite.id));
  const rowsBySuite = new Map<string, RankedRunRow[]>();

  for (const row of rankedRuns) {
    if (!requested.has(row.suiteId)) continue;

    const rows = rowsBySuite.get(row.suiteId) ?? [];
    rows.push(row);
    rowsBySuite.set(row.suiteId, rows);
  }

  return suites.map(({ id: suiteId, name: suiteName }) => {
    const rows = rowsBySuite.get(suiteId) ?? [];
    const mostRecent = rows[0];
    const trend = rows
      .slice()
      .reverse()
      .map((row) => row.status);

    return {
      suiteId,
      suiteName,
      lastRun:
        mostRecent === undefined
          ? null
          : {
              id: mostRecent.id,
              status: mostRecent.status,
              source: mostRecent.source,
              startedAt: mostRecent.startedAt.toISOString(),
              ...(mostRecent.finishedAt === null
                ? {}
                : { finishedAt: mostRecent.finishedAt.toISOString() }),
              passRate: passRateByRunId.get(mostRecent.id) ?? 0,
            },
      trend,
    };
  });
}
