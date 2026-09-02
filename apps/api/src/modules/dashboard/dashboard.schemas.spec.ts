import { dashboardSummaryQuerySchema } from './dashboard.schemas';

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
