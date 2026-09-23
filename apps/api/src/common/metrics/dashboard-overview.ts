import { computePassRate } from '@qably/types';
import type {
  CaseStatus,
  DailyPoint,
  DashboardOverviewKpis,
  DashboardOverviewRecord,
  DashboardPeriod,
  DashboardProjectRow,
  DashboardRecentRun,
  RunCaseCounts,
  RunSource,
  RunStatus,
} from '@qably/types';
import { emptyCaseCounts, sumCaseCounts } from './run-case-metrics';

export type SeriesWindow = 'current' | 'previous';

export interface CaseCountRow {
  projectId: string;
  window: SeriesWindow;
  day: string;
  status: CaseStatus;
  count: number;
}

export interface RunCountRow {
  window: SeriesWindow;
  day: string;
  runs: number;
  failedRuns: number;
  finishedRuns: number;
  durationSumMs: number;
}

export interface CasesPassingRow {
  status: CaseStatus;
  count: number;
}

export interface ProjectRow {
  id: string;
  name: string;
}

export interface RecentRunRow {
  id: string;
  projectId: string;
  projectName: string;
  suiteId: string;
  suiteName: string;
  name: string;
  status: RunStatus;
  source: RunSource;
  startedAt: Date;
  finishedAt: Date | null;
  commitSha: string | null;
  commitMessage: string | null;
  commitAuthor: string | null;
  caseCounts: RunCaseCounts;
}

export interface BuildDashboardOverviewInput {
  period: DashboardPeriod;
  zone: string;
  currentDayKeys: readonly string[];
  previousDayKeys: readonly string[];
  caseCountRows: readonly CaseCountRow[];
  runCountRows: readonly RunCountRow[];
  casesPassingRows: readonly CasesPassingRow[];
  projects: readonly ProjectRow[];
  suiteCountByProjectId: ReadonlyMap<string, number>;
  caseCountByProjectId: ReadonlyMap<string, number>;
  lastRunAtByProjectId: ReadonlyMap<string, Date>;
  recentRuns: readonly RecentRunRow[];
}

interface DayAggregate {
  date: string;
  counts: RunCaseCounts;
  runs: number;
  failedRuns: number;
  finishedRuns: number;
  durationSumMs: number;
}

function emptyDayAggregate(date: string): DayAggregate {
  return {
    date,
    counts: emptyCaseCounts(),
    runs: 0,
    failedRuns: 0,
    finishedRuns: 0,
    durationSumMs: 0,
  };
}

function buildDayAggregates(
  dayKeys: readonly string[],
  window: SeriesWindow,
  caseCountRows: readonly CaseCountRow[],
  runCountRows: readonly RunCountRow[],
): DayAggregate[] {
  const byDay = new Map<string, DayAggregate>();
  for (const day of dayKeys) byDay.set(day, emptyDayAggregate(day));

  for (const row of caseCountRows) {
    if (row.window !== window) continue;
    const aggregate = byDay.get(row.day);
    if (aggregate === undefined) continue;

    aggregate.counts[row.status] += row.count;
    aggregate.counts.total += row.count;
  }

  for (const row of runCountRows) {
    if (row.window !== window) continue;
    const aggregate = byDay.get(row.day);
    if (aggregate === undefined) continue;

    aggregate.runs += row.runs;
    aggregate.failedRuns += row.failedRuns;
    aggregate.finishedRuns += row.finishedRuns;
    aggregate.durationSumMs += row.durationSumMs;
  }

  return dayKeys.map((day) => byDay.get(day) as DayAggregate);
}

function bucketGranularity(period: DashboardPeriod): 'day' | 'week' {
  return period === 90 ? 'week' : 'day';
}

function isoWeekStartKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (utcDate.getUTCDay() + 6) % 7;

  utcDate.setUTCDate(utcDate.getUTCDate() - daysSinceMonday);

  const weekYear = utcDate.getUTCFullYear();
  const weekMonth = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const weekDay = String(utcDate.getUTCDate()).padStart(2, '0');

  return `${weekYear}-${weekMonth}-${weekDay}`;
}

function groupWeekly(dayAggregates: readonly DayAggregate[]): DayAggregate[] {
  const byWeek = new Map<string, DayAggregate>();
  const order: string[] = [];

  for (const day of dayAggregates) {
    const key = isoWeekStartKey(day.date);
    let bucket = byWeek.get(key);

    if (bucket === undefined) {
      bucket = emptyDayAggregate(key);
      byWeek.set(key, bucket);
      order.push(key);
    }

    bucket.counts = sumCaseCounts([bucket.counts, day.counts]);
    bucket.runs += day.runs;
    bucket.failedRuns += day.failedRuns;
    bucket.finishedRuns += day.finishedRuns;
    bucket.durationSumMs += day.durationSumMs;
  }

  return order.map((key) => byWeek.get(key) as DayAggregate);
}

function resolveBuckets(
  period: DashboardPeriod,
  dayKeys: readonly string[],
  window: SeriesWindow,
  caseCountRows: readonly CaseCountRow[],
  runCountRows: readonly RunCountRow[],
): DayAggregate[] {
  const dayAggregates = buildDayAggregates(
    dayKeys,
    window,
    caseCountRows,
    runCountRows,
  );

  return bucketGranularity(period) === 'week'
    ? groupWeekly(dayAggregates)
    : dayAggregates;
}

function toDailyPoint(bucket: DayAggregate): DailyPoint {
  return {
    date: bucket.date,
    passRate: computePassRate(bucket.counts),
    runs: bucket.runs,
    failedRuns: bucket.failedRuns,
  };
}

function aggregatePassRate(buckets: readonly DayAggregate[]): number | null {
  return computePassRate(sumCaseCounts(buckets.map((bucket) => bucket.counts)));
}

function aggregateRuns(buckets: readonly DayAggregate[]): number {
  return buckets.reduce((sum, bucket) => sum + bucket.runs, 0);
}

function aggregateFailedCases(buckets: readonly DayAggregate[]): number {
  return buckets.reduce((sum, bucket) => sum + bucket.counts.fail, 0);
}

function aggregateAvgDuration(buckets: readonly DayAggregate[]): number | null {
  const finishedRuns = buckets.reduce(
    (sum, bucket) => sum + bucket.finishedRuns,
    0,
  );
  if (finishedRuns === 0) return null;

  const durationSumMs = buckets.reduce(
    (sum, bucket) => sum + bucket.durationSumMs,
    0,
  );

  return durationSumMs / finishedRuns;
}

function extractPassRate(bucket: DayAggregate): number | null {
  return computePassRate(bucket.counts);
}

function extractRuns(bucket: DayAggregate): number {
  return bucket.runs;
}

function extractFailedCases(bucket: DayAggregate): number {
  return bucket.counts.fail;
}

function extractAvgDuration(bucket: DayAggregate): number | null {
  return bucket.finishedRuns === 0
    ? null
    : bucket.durationSumMs / bucket.finishedRuns;
}

function buildKpi(
  currentBuckets: readonly DayAggregate[],
  previousBuckets: readonly DayAggregate[],
  extract: (bucket: DayAggregate) => number | null,
  aggregate: (buckets: readonly DayAggregate[]) => number | null,
) {
  return {
    value: aggregate(currentBuckets),
    previous: aggregate(previousBuckets),
    series: currentBuckets.map(extract),
  };
}

function buildCasesPassing(rows: readonly CasesPassingRow[]): RunCaseCounts {
  const counts = emptyCaseCounts();

  for (const row of rows) {
    counts[row.status] += row.count;
    counts.total += row.count;
  }

  return counts;
}

function buildProjectRows(
  projects: readonly ProjectRow[],
  suiteCountByProjectId: ReadonlyMap<string, number>,
  caseCountByProjectId: ReadonlyMap<string, number>,
  lastRunAtByProjectId: ReadonlyMap<string, Date>,
  caseCountRows: readonly CaseCountRow[],
): DashboardProjectRow[] {
  const currentCountsByProject = new Map<string, RunCaseCounts>();

  for (const row of caseCountRows) {
    if (row.window !== 'current') continue;

    const counts =
      currentCountsByProject.get(row.projectId) ?? emptyCaseCounts();

    counts[row.status] += row.count;
    counts.total += row.count;
    currentCountsByProject.set(row.projectId, counts);
  }

  return projects.map((project) => {
    const lastRunAt = lastRunAtByProjectId.get(project.id);

    return {
      id: project.id,
      name: project.name,
      suites: suiteCountByProjectId.get(project.id) ?? 0,
      cases: caseCountByProjectId.get(project.id) ?? 0,
      passRate: computePassRate(
        currentCountsByProject.get(project.id) ?? emptyCaseCounts(),
      ),
      ...(lastRunAt === undefined
        ? {}
        : { lastRunAt: lastRunAt.toISOString() }),
    };
  });
}

function buildRecentRuns(rows: readonly RecentRunRow[]): DashboardRecentRun[] {
  return rows.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    projectName: row.projectName,
    suiteId: row.suiteId,
    suiteName: row.suiteName,
    name: row.name,
    status: row.status,
    source: row.source,
    startedAt: row.startedAt.toISOString(),
    ...(row.finishedAt === null
      ? {}
      : { finishedAt: row.finishedAt.toISOString() }),
    ...(row.commitSha === null ? {} : { commitSha: row.commitSha }),
    ...(row.commitMessage === null ? {} : { commitMessage: row.commitMessage }),
    ...(row.commitAuthor === null ? {} : { commitAuthor: row.commitAuthor }),
    passRate: computePassRate(row.caseCounts),
  }));
}

export function buildDashboardOverview(
  input: BuildDashboardOverviewInput,
): DashboardOverviewRecord {
  const currentBuckets = resolveBuckets(
    input.period,
    input.currentDayKeys,
    'current',
    input.caseCountRows,
    input.runCountRows,
  );
  const previousBuckets = resolveBuckets(
    input.period,
    input.previousDayKeys,
    'previous',
    input.caseCountRows,
    input.runCountRows,
  );

  const kpis: DashboardOverviewKpis = {
    passRate: buildKpi(
      currentBuckets,
      previousBuckets,
      extractPassRate,
      aggregatePassRate,
    ),
    runs: buildKpi(currentBuckets, previousBuckets, extractRuns, aggregateRuns),
    failedCases: buildKpi(
      currentBuckets,
      previousBuckets,
      extractFailedCases,
      aggregateFailedCases,
    ),
    avgRunDurationMs: buildKpi(
      currentBuckets,
      previousBuckets,
      extractAvgDuration,
      aggregateAvgDuration,
    ),
  };

  return {
    period: input.period,
    timeZone: input.zone,
    kpis,
    passRateSeries: {
      current: currentBuckets.map(toDailyPoint),
      previous: previousBuckets.map(toDailyPoint),
    },
    casesPassing: buildCasesPassing(input.casesPassingRows),
    projects: buildProjectRows(
      input.projects,
      input.suiteCountByProjectId,
      input.caseCountByProjectId,
      input.lastRunAtByProjectId,
      input.caseCountRows,
    ),
    recentRuns: buildRecentRuns(input.recentRuns),
  };
}
