import { buildBatchNotificationEvent } from './build-batch-notification';

const baseParams = {
  organizationId: 'org-1',
  projectId: 'project-1',
  reportExternalId: 'gha-482913',
};

describe('buildBatchNotificationEvent', () => {
  it('publishes run_completed with only a count when every result passed', () => {
    const event = buildBatchNotificationEvent({
      ...baseParams,
      results: [
        { suiteName: 'a.test.ts', status: 'pass' },
        { suiteName: 'b.test.ts', status: 'pass' },
      ],
    });

    expect(event.eventType).toBe('run_completed');
    expect(event.severity).toBe('low');
    expect(event.payload).toEqual({ count: 2 });
  });

  it('publishes run_failed listing the failed suite names when a result failed', () => {
    const event = buildBatchNotificationEvent({
      ...baseParams,
      results: [
        { suiteName: 'a.test.ts', status: 'pass' },
        { suiteName: 'b.test.ts', status: 'fail' },
      ],
    });

    expect(event.eventType).toBe('run_failed');
    expect(event.severity).toBe('high');
    expect(event.payload).toEqual({
      count: 2,
      failedCount: 1,
      failedSuiteNames: 'b.test.ts',
    });
  });

  it('publishes run_failed listing the rejected suite names when a group was rejected, even with no failures', () => {
    const event = buildBatchNotificationEvent({
      ...baseParams,
      results: [
        { suiteName: 'a.test.ts', status: 'pass' },
        {
          suiteName: 'b.test.ts',
          status: 'rejected',
          reason: 'suiteName: too short',
        },
      ],
    });

    expect(event.eventType).toBe('run_failed');
    expect(event.severity).toBe('high');
    expect(event.payload).toEqual({
      count: 2,
      rejectedCount: 1,
      rejectedSuiteNames: 'b.test.ts',
    });
    expect(event.payload).not.toHaveProperty('failedCount');
  });

  it('lists both failed and rejected suite names when a batch has both', () => {
    const event = buildBatchNotificationEvent({
      ...baseParams,
      results: [
        { suiteName: 'a.test.ts', status: 'fail' },
        { suiteName: 'b.test.ts', status: 'rejected', reason: 'invalid' },
      ],
    });

    expect(event.payload).toEqual({
      count: 2,
      failedCount: 1,
      failedSuiteNames: 'a.test.ts',
      rejectedCount: 1,
      rejectedSuiteNames: 'b.test.ts',
    });
  });
});
