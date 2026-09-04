import {
  dashboardSummaryQuerySchema,
  dashboardTraceabilityQuerySchema,
} from './dashboard.schemas';

describe('dashboardSummaryQuerySchema', () => {
  it('accepts an empty query', () => {
    const result = dashboardSummaryQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.success && result.data.projectId).toBeUndefined();
  });

  it('accepts a projectId', () => {
    const result = dashboardSummaryQuerySchema.safeParse({
      projectId: 'project-1',
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.projectId).toBe('project-1');
  });

  it('rejects an empty projectId', () => {
    const result = dashboardSummaryQuerySchema.safeParse({ projectId: '' });

    expect(result.success).toBe(false);
  });
});

describe('dashboardTraceabilityQuerySchema', () => {
  it('coerces the year from the query string', () => {
    const result = dashboardTraceabilityQuerySchema.safeParse({ year: '2026' });

    expect(result.success).toBe(true);
    expect(result.success && result.data.year).toBe(2026);
  });

  it('requires a year rather than guessing one', () => {
    const result = dashboardTraceabilityQuerySchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it('rejects a year outside the supported range', () => {
    expect(
      dashboardTraceabilityQuerySchema.safeParse({ year: '1999' }).success,
    ).toBe(false);
    expect(
      dashboardTraceabilityQuerySchema.safeParse({ year: '2999' }).success,
    ).toBe(false);
  });

  it('rejects a year that is not an integer', () => {
    expect(
      dashboardTraceabilityQuerySchema.safeParse({ year: '2026.5' }).success,
    ).toBe(false);
    expect(
      dashboardTraceabilityQuerySchema.safeParse({ year: 'abc' }).success,
    ).toBe(false);
  });

  it('accepts an optional projectId alongside the year', () => {
    const result = dashboardTraceabilityQuerySchema.safeParse({
      year: '2026',
      projectId: 'project-1',
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.projectId).toBe('project-1');
  });

  it('rejects an empty projectId', () => {
    expect(
      dashboardTraceabilityQuerySchema.safeParse({
        year: '2026',
        projectId: '',
      }).success,
    ).toBe(false);
  });
});
