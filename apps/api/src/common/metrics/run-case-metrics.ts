import type { CaseStatus, RunCaseCounts } from '@qably/types';

export const DASHBOARD_WINDOW_DAYS = 7;
export const RECENT_RUNS_LIMIT = 5;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const ZERO_CASE_COUNTS: RunCaseCounts = {
  total: 0,
  pending: 0,
  running: 0,
  pass: 0,
  fail: 0,
  skip: 0,
  blocked: 0,
};

export interface MetricsWindow {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
}

export function emptyCaseCounts(): RunCaseCounts {
  return { ...ZERO_CASE_COUNTS };
}

export function computeMetricsWindow(
  now: Date,
  windowDays: number = DASHBOARD_WINDOW_DAYS,
): MetricsWindow {
  const currentStart = new Date(now.getTime() - windowDays * DAY_IN_MS);
  const previousStart = new Date(
    currentStart.getTime() - windowDays * DAY_IN_MS,
  );

  return {
    currentStart,
    currentEnd: now,
    previousStart,
    previousEnd: currentStart,
  };
}

export function tallyCaseStatuses(
  groups: readonly { status: CaseStatus; _count: { _all: number } }[],
): RunCaseCounts {
  const counts = emptyCaseCounts();

  for (const group of groups) {
    counts[group.status] += group._count._all;
    counts.total += group._count._all;
  }

  return counts;
}

export function buildCaseCountsByRun(
  groups: readonly {
    runId: string;
    status: CaseStatus;
    _count: { _all: number };
  }[],
): Map<string, RunCaseCounts> {
  const countsByRun = new Map<string, RunCaseCounts>();

  for (const group of groups) {
    const counts = countsByRun.get(group.runId) ?? emptyCaseCounts();

    counts[group.status] += group._count._all;
    counts.total += group._count._all;
    countsByRun.set(group.runId, counts);
  }

  return countsByRun;
}

export function sumCaseCounts(
  countsList: readonly RunCaseCounts[],
): RunCaseCounts {
  const sum = emptyCaseCounts();

  for (const counts of countsList) {
    sum.total += counts.total;
    sum.pending += counts.pending;
    sum.running += counts.running;
    sum.pass += counts.pass;
    sum.fail += counts.fail;
    sum.skip += counts.skip;
    sum.blocked += counts.blocked;
  }

  return sum;
}

export function computePassRate(
  counts: Pick<RunCaseCounts, 'pass' | 'total'>,
): number {
  return counts.total === 0 ? 0 : counts.pass / counts.total;
}

export function computeHealthScore(
  counts: Pick<RunCaseCounts, 'pass' | 'total'>,
): number | null {
  return counts.total === 0 ? null : Math.round(computePassRate(counts) * 100);
}

export function computePassRateTrend(
  currentPassRate: number,
  previousPassRate: number,
): number {
  return currentPassRate - previousPassRate;
}
