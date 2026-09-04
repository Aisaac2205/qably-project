import {
  TRACEABILITY_TIME_ZONE,
  buildTraceabilityCalendar,
  type TraceabilityStageRows,
} from './traceability-calendar';

function rows(
  overrides: Partial<TraceabilityStageRows> = {},
): TraceabilityStageRows {
  return {
    scm: [],
    official: [],
    runs: [],
    ...overrides,
  };
}

describe('buildTraceabilityCalendar', () => {
  it('reports the year and the time zone the days were bucketed in', () => {
    const calendar = buildTraceabilityCalendar(2026, rows());

    expect(calendar.year).toBe(2026);
    expect(calendar.timeZone).toBe(TRACEABILITY_TIME_ZONE);
  });

  it('merges the stages of one day into a single entry', () => {
    const calendar = buildTraceabilityCalendar(
      2026,
      rows({
        scm: [{ day: '2026-06-16', count: 2 }],
        official: [{ day: '2026-06-16', count: 5 }],
        runs: [{ day: '2026-06-16', count: 214 }],
      }),
    );

    expect(calendar.days).toEqual([
      { date: '2026-06-16', scm: 2, proposals: 0, official: 5, runs: 214 },
    ]);
  });

  it('reports zero for stages that had no activity on a day', () => {
    const calendar = buildTraceabilityCalendar(
      2026,
      rows({ runs: [{ day: '2026-06-16', count: 3 }] }),
    );

    expect(calendar.days[0]).toEqual({
      date: '2026-06-16',
      scm: 0,
      proposals: 0,
      official: 0,
      runs: 3,
    });
  });

  it('reports the proposals stage as zero while the Review/AI domain has no model', () => {
    const calendar = buildTraceabilityCalendar(
      2026,
      rows({ runs: [{ day: '2026-06-16', count: 3 }] }),
    );

    expect(calendar.totals.proposals).toBe(0);
    expect(calendar.days.every((day) => day.proposals === 0)).toBe(true);
  });

  it('omits days with no activity instead of padding the whole year', () => {
    const calendar = buildTraceabilityCalendar(
      2026,
      rows({ runs: [{ day: '2026-06-16', count: 1 }] }),
    );

    expect(calendar.days).toHaveLength(1);
  });

  it('orders days chronologically regardless of the order the stages arrived in', () => {
    const calendar = buildTraceabilityCalendar(
      2026,
      rows({
        runs: [
          { day: '2026-12-31', count: 1 },
          { day: '2026-01-01', count: 1 },
        ],
        scm: [{ day: '2026-06-16', count: 1 }],
      }),
    );

    expect(calendar.days.map((day) => day.date)).toEqual([
      '2026-01-01',
      '2026-06-16',
      '2026-12-31',
    ]);
  });

  it('totals each stage across the year', () => {
    const calendar = buildTraceabilityCalendar(
      2026,
      rows({
        scm: [
          { day: '2026-01-01', count: 2 },
          { day: '2026-01-02', count: 3 },
        ],
        official: [{ day: '2026-01-01', count: 7 }],
        runs: [
          { day: '2026-01-01', count: 10 },
          { day: '2026-01-02', count: 20 },
        ],
      }),
    );

    expect(calendar.totals).toEqual({
      scm: 5,
      proposals: 0,
      official: 7,
      runs: 30,
    });
  });

  it('returns an empty year rather than failing when nothing happened', () => {
    const calendar = buildTraceabilityCalendar(2026, rows());

    expect(calendar.days).toEqual([]);
    expect(calendar.totals).toEqual({
      scm: 0,
      proposals: 0,
      official: 0,
      runs: 0,
    });
  });

  it('buckets in Guatemala time so a late local evening stays on its own day', () => {
    expect(TRACEABILITY_TIME_ZONE).toBe('America/Guatemala');
  });
});
