import type { RunSummaryRecord } from '@qably/types';
import type { OrgContext } from '../organizations/organizations.contracts';
import { DashboardService } from './dashboard.service';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'member',
};

const NOW = new Date('2026-06-16T11:00:00.000Z');

function runSummary(
  overrides: Partial<RunSummaryRecord> = {},
): RunSummaryRecord {
  return {
    id: 'run-1',
    projectId: 'project-1',
    organizationId: 'org-1',
    suiteId: 'suite-1',
    name: 'Checkout regression',
    status: 'pass',
    source: 'manual',
    externalId: '',
    startedAt: '2026-06-16T10:00:00.000Z',
    caseCounts: {
      total: 2,
      pending: 0,
      running: 0,
      pass: 2,
      fail: 0,
      skip: 0,
      blocked: 0,
    },
    passRate: 1,
    ...overrides,
  };
}

interface FakePrisma {
  project: { findFirst: jest.Mock; count: jest.Mock };
  suite: { count: jest.Mock };
  run: { count: jest.Mock };
  runCase: { groupBy: jest.Mock };
}

function createPrisma(): FakePrisma {
  return {
    project: {
      findFirst: jest.fn().mockResolvedValue({ id: 'project-1' }),
      count: jest.fn().mockResolvedValue(3),
    },
    suite: { count: jest.fn().mockResolvedValue(5) },
    run: { count: jest.fn().mockResolvedValue(10) },
    runCase: { groupBy: jest.fn().mockResolvedValue([]) },
  };
}

interface FakeRunQueries {
  list: jest.Mock;
}

function createRunQueries(runs: RunSummaryRecord[] = []): FakeRunQueries {
  return { list: jest.fn().mockResolvedValue(runs) };
}

function build(prisma: FakePrisma, runQueries: FakeRunQueries) {
  return new DashboardService(prisma as never, runQueries as never);
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick'] });
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('DashboardService.summary organization scope', () => {
  it('scopes every count to the caller organization when no project is given', async () => {
    const prisma = createPrisma();
    const runQueries = createRunQueries();

    await build(prisma, runQueries).summary(org);

    expect(prisma.suite.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
    });
    expect(prisma.run.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
    });
  });

  it('reports the organization-wide project count when unscoped', async () => {
    const prisma = createPrisma();
    prisma.project.count.mockResolvedValue(4);
    const runQueries = createRunQueries();

    const result = await build(prisma, runQueries).summary(org);

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.totalProjects).toBe(4);
  });

  it('never looks up a single project when none is requested', async () => {
    const prisma = createPrisma();
    const runQueries = createRunQueries();

    await build(prisma, runQueries).summary(org);

    expect(prisma.project.findFirst).not.toHaveBeenCalled();
  });
});

describe('DashboardService.summary project scope', () => {
  it('returns project-not-found for a project outside the organization', async () => {
    const prisma = createPrisma();
    prisma.project.findFirst.mockResolvedValue(null);
    const runQueries = createRunQueries();

    const result = await build(prisma, runQueries).summary(org, 'project-x');

    expect(result).toEqual({ ok: false, error: 'project-not-found' });
    expect(prisma.suite.count).not.toHaveBeenCalled();
  });

  it('validates the project against the caller organization', async () => {
    const prisma = createPrisma();
    const runQueries = createRunQueries();

    await build(prisma, runQueries).summary(org, 'project-1');

    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'project-1', organizationId: 'org-1' },
      }),
    );
  });

  it('scopes suite and run counts to the given project', async () => {
    const prisma = createPrisma();
    const runQueries = createRunQueries();

    await build(prisma, runQueries).summary(org, 'project-1');

    expect(prisma.suite.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', projectId: 'project-1' },
    });
    expect(prisma.run.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', projectId: 'project-1' },
    });
  });

  it('reports a project count of one when scoped to a single project', async () => {
    const prisma = createPrisma();
    const runQueries = createRunQueries();

    const result = await build(prisma, runQueries).summary(org, 'project-1');

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.totalProjects).toBe(1);
  });

  it('passes the projectId through to the reused run summaries', async () => {
    const prisma = createPrisma();
    const runQueries = createRunQueries();

    await build(prisma, runQueries).summary(org, 'project-1');

    expect(runQueries.list).toHaveBeenCalledWith(org, 'project-1');
  });
});

describe('DashboardService.summary time window', () => {
  it('counts runs started within the trailing window using the servers own clock', async () => {
    const prisma = createPrisma();
    const runQueries = createRunQueries();

    await build(prisma, runQueries).summary(org);

    const windowedCall = prisma.run.count.mock.calls.find(
      ([args]: [{ where: Record<string, unknown> }]) =>
        'startedAt' in args.where,
    ) as [{ where: { startedAt: { gte: Date; lte: Date } } }];

    expect(windowedCall[0].where.startedAt.lte).toEqual(NOW);
    expect(windowedCall[0].where.startedAt.gte).toEqual(
      new Date('2026-06-09T11:00:00.000Z'),
    );
  });

  it('reports the fixed window length used for every windowed metric', async () => {
    const prisma = createPrisma();
    const runQueries = createRunQueries();

    const result = await build(prisma, runQueries).summary(org);

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.windowDays).toBe(7);
  });

  it('counts runs with status running as active regardless of the window', async () => {
    const prisma = createPrisma();
    const runQueries = createRunQueries();

    await build(prisma, runQueries).summary(org);

    expect(prisma.run.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', status: 'running' },
    });
  });
});

describe('DashboardService.summary pass rate and defects', () => {
  it('computes the pass rate from the current window case tally', async () => {
    const prisma = createPrisma();
    prisma.runCase.groupBy
      .mockResolvedValueOnce([
        { status: 'pass', _count: { _all: 3 } },
        { status: 'fail', _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([]);
    const runQueries = createRunQueries();

    const result = await build(prisma, runQueries).summary(org);

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.passRate).toBeCloseTo(0.75);
    expect(result.ok && result.value.defectsDetected).toBe(1);
  });

  it('reports the delta against the preceding window as the trend', async () => {
    const prisma = createPrisma();
    prisma.runCase.groupBy
      .mockResolvedValueOnce([{ status: 'pass', _count: { _all: 8 } }])
      .mockResolvedValueOnce([
        { status: 'pass', _count: { _all: 4 } },
        { status: 'fail', _count: { _all: 4 } },
      ]);
    const runQueries = createRunQueries();

    const result = await build(prisma, runQueries).summary(org);

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.passRateTrend).toBeCloseTo(0.5);
  });

  it('queries the current and previous windows as two non-overlapping ranges', async () => {
    const prisma = createPrisma();
    const runQueries = createRunQueries();

    await build(prisma, runQueries).summary(org);

    const [firstCall, secondCall] = prisma.runCase.groupBy.mock.calls as [
      { where: { run: { startedAt: { gte: Date; lte?: Date; lt?: Date } } } },
    ][];

    expect(firstCall[0].where.run.startedAt.gte).toEqual(
      new Date('2026-06-09T11:00:00.000Z'),
    );
    expect(secondCall[0].where.run.startedAt.gte).toEqual(
      new Date('2026-06-02T11:00:00.000Z'),
    );
    expect(secondCall[0].where.run.startedAt.lt).toEqual(
      firstCall[0].where.run.startedAt.gte,
    );
  });
});

describe('DashboardService.summary recent runs', () => {
  it('takes the recent runs from the already-sorted run summaries', async () => {
    const runs = Array.from({ length: 8 }, (_, index) =>
      runSummary({ id: `run-${index}` }),
    );
    const prisma = createPrisma();
    const runQueries = createRunQueries(runs);

    const result = await build(prisma, runQueries).summary(org);

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.recentRuns).toHaveLength(5);
    expect(result.ok && result.value.recentRuns[0].id).toBe('run-0');
  });

  it('filters recent CI runs by github_actions source', async () => {
    const runs = [
      runSummary({ id: 'run-manual', source: 'manual' }),
      runSummary({ id: 'run-ci-1', source: 'github_actions' }),
      runSummary({ id: 'run-ci-2', source: 'github_actions' }),
    ];
    const prisma = createPrisma();
    const runQueries = createRunQueries(runs);

    const result = await build(prisma, runQueries).summary(org);

    expect(result.ok).toBe(true);
    expect(
      result.ok &&
        result.value.recentCiRuns.every(
          (run) => run.source === 'github_actions',
        ),
    ).toBe(true);
    expect(result.ok && result.value.recentCiRuns).toHaveLength(2);
  });
});
