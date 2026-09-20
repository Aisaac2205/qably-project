import {
  REPORT_BATCH_TIMEOUT_DELAY_MS,
  REPORT_BATCH_TIMEOUT_JOB,
} from './runs.contracts';
import { ReportBatchService } from './report-batch.service';

function createRedis() {
  const store = new Map<string, Map<string, string>>();

  return {
    store,
    recordReportSuiteResult: jest.fn(
      (
        key: string,
        size: string,
        organizationId: string,
        projectId: string,
        reportExternalId: string,
        field: string,
        value: string,
      ) => {
        const hash = store.get(key) ?? new Map<string, string>();
        const created = !hash.has('size');
        if (created) {
          hash.set('size', size);
          hash.set('organizationId', organizationId);
          hash.set('projectId', projectId);
          hash.set('reportExternalId', reportExternalId);
        }
        hash.set(field, value);
        store.set(key, hash);

        const resultCount = [...hash.keys()].filter((k) =>
          k.startsWith('result:'),
        ).length;
        const expectedSize = Number(hash.get('size'));

        if (resultCount < expectedSize) {
          return Promise.resolve(
            JSON.stringify({ complete: false, created: created ? 1 : 0 }),
          );
        }

        const data = Object.fromEntries(hash.entries());
        store.delete(key);
        return Promise.resolve(
          JSON.stringify({ complete: true, created: created ? 1 : 0, data }),
        );
      },
    ),
    flushReportBatch: jest.fn((key: string) => {
      const hash = store.get(key);
      if (hash === undefined) {
        return Promise.resolve(JSON.stringify({ found: false }));
      }
      const data = Object.fromEntries(hash.entries());
      store.delete(key);
      return Promise.resolve(JSON.stringify({ found: true, data }));
    }),
    quit: jest.fn().mockResolvedValue(undefined),
  };
}

function createQueue() {
  return { add: jest.fn().mockResolvedValue(undefined) };
}

function createNotifications() {
  return { publish: jest.fn().mockResolvedValue(undefined) };
}

function build() {
  const redis = createRedis();
  const queue = createQueue();
  const notifications = createNotifications();
  const service = new ReportBatchService(
    redis,
    queue as never,
    notifications as never,
  );

  return { service, redis, queue, notifications };
}

const baseParams = {
  organizationId: 'org-1',
  projectId: 'project-1',
  source: 'api',
  reportExternalId: 'gha-482913',
};

describe('ReportBatchService.recordAndMaybePublish', () => {
  it('enqueues a delayed safety-net timeout job only for the first suite of a report', async () => {
    const { service, queue } = build();

    await service.recordAndMaybePublish({
      ...baseParams,
      reportSize: 3,
      runId: 'run-1',
      suiteName: 'a.test.ts',
      status: 'pass',
    });
    await service.recordAndMaybePublish({
      ...baseParams,
      reportSize: 3,
      runId: 'run-2',
      suiteName: 'b.test.ts',
      status: 'pass',
    });

    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      REPORT_BATCH_TIMEOUT_JOB,
      { key: expect.stringContaining('report-batch:') as unknown },
      expect.objectContaining({ delay: REPORT_BATCH_TIMEOUT_DELAY_MS }),
    );
  });

  it('does not publish anything while the batch is incomplete', async () => {
    const { service, notifications } = build();

    await service.recordAndMaybePublish({
      ...baseParams,
      reportSize: 3,
      runId: 'run-1',
      suiteName: 'a.test.ts',
      status: 'pass',
    });
    await service.recordAndMaybePublish({
      ...baseParams,
      reportSize: 3,
      runId: 'run-2',
      suiteName: 'b.test.ts',
      status: 'pass',
    });

    expect(notifications.publish).not.toHaveBeenCalled();
  });

  it('publishes exactly one run_completed notification once every suite in the batch passes', async () => {
    const { service, notifications, redis } = build();

    for (const [runId, suiteName] of [
      ['run-1', 'a.test.ts'],
      ['run-2', 'b.test.ts'],
      ['run-3', 'c.test.ts'],
    ] as const) {
      await service.recordAndMaybePublish({
        ...baseParams,
        reportSize: 3,
        runId,
        suiteName,
        status: 'pass',
      });
    }

    expect(notifications.publish).toHaveBeenCalledTimes(1);
    expect(notifications.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'run_completed',
        dedupeKey: 'run_completed:report:gha-482913',
        payload: { count: 3 },
      }),
    );
    expect(redis.store.size).toBe(0);
  });

  it('publishes exactly once even when the last two suites of a batch arrive concurrently', async () => {
    const { service, notifications, redis } = build();

    await service.recordAndMaybePublish({
      ...baseParams,
      reportSize: 3,
      runId: 'run-1',
      suiteName: 'a.test.ts',
      status: 'pass',
    });

    await Promise.all([
      service.recordAndMaybePublish({
        ...baseParams,
        reportSize: 3,
        runId: 'run-2',
        suiteName: 'b.test.ts',
        status: 'pass',
      }),
      service.recordAndMaybePublish({
        ...baseParams,
        reportSize: 3,
        runId: 'run-3',
        suiteName: 'c.test.ts',
        status: 'pass',
      }),
    ]);

    expect(notifications.publish).toHaveBeenCalledTimes(1);
    expect(redis.store.size).toBe(0);
  });

  it('publishes exactly one run_failed notification listing only the failed suite names', async () => {
    const { service, notifications } = build();

    await service.recordAndMaybePublish({
      ...baseParams,
      reportSize: 3,
      runId: 'run-1',
      suiteName: 'a.test.ts',
      status: 'pass',
    });
    await service.recordAndMaybePublish({
      ...baseParams,
      reportSize: 3,
      runId: 'run-2',
      suiteName: 'b.test.ts',
      status: 'fail',
    });
    await service.recordAndMaybePublish({
      ...baseParams,
      reportSize: 3,
      runId: 'run-3',
      suiteName: 'c.test.ts',
      status: 'pass',
    });

    expect(notifications.publish).toHaveBeenCalledTimes(1);
    expect(notifications.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'run_failed',
        dedupeKey: 'run_failed:report:gha-482913',
        payload: {
          count: 3,
          failedCount: 1,
          failedSuiteNames: 'b.test.ts',
        },
      }),
    );
  });

  it('cleans up the redis key once the batch closes', async () => {
    const { service, redis } = build();

    for (const [runId, suiteName] of [
      ['run-1', 'a.test.ts'],
      ['run-2', 'b.test.ts'],
    ] as const) {
      await service.recordAndMaybePublish({
        ...baseParams,
        reportSize: 2,
        runId,
        suiteName,
        status: 'pass',
      });
    }

    expect(redis.store.size).toBe(0);
  });
});

describe('ReportBatchService.flushIfPending', () => {
  it('publishes the partial results and logs a warning when the batch never closed', async () => {
    const { service, notifications, redis, queue } = build();
    const warnSpy = jest.spyOn(
      (service as unknown as { logger: { warn: (message: string) => void } })
        .logger,
      'warn',
    );

    await service.recordAndMaybePublish({
      ...baseParams,
      reportSize: 3,
      runId: 'run-1',
      suiteName: 'a.test.ts',
      status: 'pass',
    });
    await service.recordAndMaybePublish({
      ...baseParams,
      reportSize: 3,
      runId: 'run-2',
      suiteName: 'b.test.ts',
      status: 'fail',
    });

    const [, timeoutJobData] = queue.add.mock.calls[0] as [
      string,
      { key: string },
    ];

    await service.flushIfPending(timeoutJobData.key);

    expect(notifications.publish).toHaveBeenCalledTimes(1);
    expect(notifications.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'run_failed',
        dedupeKey: 'run_failed:report:gha-482913',
        payload: expect.objectContaining({
          count: 2,
          failedCount: 1,
          failedSuiteNames: 'b.test.ts',
        }) as unknown,
      }),
    );
    expect(warnSpy).toHaveBeenCalled();
    expect(redis.store.size).toBe(0);
  });

  it('does nothing when the batch already closed normally before the timeout fired', async () => {
    const { service, notifications, redis } = build();

    for (const [runId, suiteName] of [
      ['run-1', 'a.test.ts'],
      ['run-2', 'b.test.ts'],
    ] as const) {
      await service.recordAndMaybePublish({
        ...baseParams,
        reportSize: 2,
        runId,
        suiteName,
        status: 'pass',
      });
    }

    notifications.publish.mockClear();

    await service.flushIfPending('report-batch:org-1:project-1:api:gha-482913');

    expect(notifications.publish).not.toHaveBeenCalled();
    expect(redis.flushReportBatch).toHaveBeenCalledTimes(1);
    expect(redis.store.size).toBe(0);
  });
});
