import type {
  TraceabilityCalendarRecord,
  TraceabilityDayRecord,
  TraceabilityStage,
  TraceabilityStageTotals,
} from '@qably/types';

export const TRACEABILITY_TIME_ZONE = 'America/Guatemala';

export type QueriedTraceabilityStage = Exclude<TraceabilityStage, 'proposals'>;

export interface TraceabilityDayCountRow {
  day: string;
  count: number;
}

export type TraceabilityStageRows = Record<
  QueriedTraceabilityStage,
  readonly TraceabilityDayCountRow[]
>;

const QUERIED_STAGES: readonly QueriedTraceabilityStage[] = [
  'scm',
  'official',
  'runs',
];

function emptyDay(date: string): TraceabilityDayRecord {
  return { date, scm: 0, proposals: 0, official: 0, runs: 0 };
}

function emptyTotals(): TraceabilityStageTotals {
  return { scm: 0, proposals: 0, official: 0, runs: 0 };
}

export function buildTraceabilityCalendar(
  year: number,
  rows: TraceabilityStageRows,
): TraceabilityCalendarRecord {
  const byDate = new Map<string, TraceabilityDayRecord>();
  const totals = emptyTotals();

  for (const stage of QUERIED_STAGES) {
    for (const row of rows[stage]) {
      const day = byDate.get(row.day) ?? emptyDay(row.day);

      day[stage] += row.count;
      totals[stage] += row.count;
      byDate.set(row.day, day);
    }
  }

  return {
    year,
    timeZone: TRACEABILITY_TIME_ZONE,
    totals,
    days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
