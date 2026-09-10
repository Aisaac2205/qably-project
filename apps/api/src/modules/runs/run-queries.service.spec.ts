import type { AuthenticatedUser } from '../auth/auth.contracts';
import type { OrgContext } from '../organizations/organizations.contracts';
import { RunQueriesService } from './run-queries.service';
import type { CreateManualRunInput } from './runs.schemas';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'member',
};

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'ada@acme.test',
  name: 'Ada Lovelace',
  emailVerified: true,
  locale: null,
};

const runRow = {
  id: 'run-1',
  projectId: 'project-1',
  organizationId: 'org-1',
  suiteId: 'suite-1',
  name: 'Checkout regression',
  status: 'pending' as const,
  source: 'manual' as const,
  externalId: null,
  startedAt: new Date('2026-01-01T00:00:00.000Z'),
  finishedAt: null,
  executedById: 'user-1',
  commitSha: null,
  commitMessage: null,
  commitAuthor: null,
  suite: { name: 'Checkout' },
};

function runCaseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-case-1',
    testCaseId: 'case-1',
    name: 'Adds to cart',
    suiteName: 'Checkout',
    steps: ['open', 'add'],
    expectedResult: 'cart has one item',
    status: 'pending' as const,
    position: 0,
    recordedAt: null,
    ...overrides,
  };
}

const suiteWithCases = {
  id: 'suite-1',
  name: 'Checkout',
  cases: [
    {
      id: 'case-1',
      name: 'Adds to cart',
      steps: ['open', 'add'],
      expectedResult: 'cart has one item',
    },
    {
      id: 'case-2',
      name: 'Removes from cart',
      steps: ['open', 'remove'],
      expectedResult: 'cart is empty',
    },
  ],
};

interface FakePrisma {
  run: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  runCase: {
    findMany: jest.Mock;
    groupBy: jest.Mock;
    createManyAndReturn: jest.Mock;
    update: jest.Mock;
  };
  suite: { findFirst: jest.Mock; findMany: jest.Mock };
  $queryRaw: jest.Mock;
  txRunCaseFindMany: jest.Mock;
  $transaction: jest.Mock;
}

function createNotifications() {
  return { publish: jest.fn().mockResolvedValue(undefined) };
}

function createPrisma(): FakePrisma {
  const prisma: FakePrisma = {
    run: {
      findMany: jest.fn().mockResolvedValue([runRow]),
      findFirst: jest.fn().mockResolvedValue(runRow),
      create: jest.fn().mockResolvedValue(runRow),
      update: jest.fn().mockResolvedValue(runRow),
    },
    runCase: {
      findMany: jest.fn().mockResolvedValue([runCaseRow()]),
      groupBy: jest.fn().mockResolvedValue([]),
      createManyAndReturn: jest.fn().mockResolvedValue([runCaseRow()]),
      update: jest.fn().mockResolvedValue(runCaseRow({ status: 'pass' })),
    },
    suite: {
      findFirst: jest.fn().mockResolvedValue(suiteWithCases),
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'suite-1', name: 'Checkout' }]),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    txRunCaseFindMany: jest.fn().mockResolvedValue([runCaseRow()]),
    $transaction: jest.fn(),
  };

  prisma.$transaction.mockImplementation((run: (tx: unknown) => unknown) =>
    run({
      run: prisma.run,
      runCase: {
        findMany: prisma.txRunCaseFindMany,
        groupBy: prisma.runCase.groupBy,
        createManyAndReturn: prisma.runCase.createManyAndReturn,
        update: prisma.runCase.update,
      },
      suite: prisma.suite,
    }),
  );

  return prisma;
}

function build(
  prisma: FakePrisma,
  notifications: { publish: jest.Mock } = createNotifications(),
) {
  return new RunQueriesService(prisma as never, notifications as never);
}

describe('RunQueriesService.list', () => {
  it('scopes runs to the caller organization', async () => {
    const prisma = createPrisma();

    await build(prisma).list(org, {});

    expect(prisma.run.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
      }),
    );
  });

  it('filters by project when a projectId is given', async () => {
    const prisma = createPrisma();

    await build(prisma).list(org, { projectId: 'project-1' });

    expect(prisma.run.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', projectId: 'project-1' },
      }),
    );
  });

  it('filters by source when a source is given', async () => {
    const prisma = createPrisma();

    await build(prisma).list(org, { source: 'github_actions' });

    expect(prisma.run.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', source: 'github_actions' },
      }),
    );
  });

  it('orders runs by startedAt descending with id as the tiebreaker', async () => {
    const prisma = createPrisma();

    await build(prisma).list(org, {});

    expect(prisma.run.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('carries the suite name so the client does not have to resolve it', async () => {
    const prisma = createPrisma();

    const { items } = await build(prisma).list(org, {});

    expect(items[0].suiteName).toBe('Checkout');
  });

  it('reads every run when no limit is given', async () => {
    const prisma = createPrisma();

    const { items, nextCursor } = await build(prisma).list(org, {});

    const calls = prisma.run.findMany.mock.calls as [Record<string, unknown>][];
    expect(calls[0][0].take).toBeUndefined();
    expect(items).toHaveLength(1);
    expect(nextCursor).toBeUndefined();
  });

  it('reads one extra row to decide whether another page exists', async () => {
    const prisma = createPrisma();

    await build(prisma).list(org, { limit: 2 });

    expect(prisma.run.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
  });

  it('returns a cursor pointing at the last item of a full page', async () => {
    const prisma = createPrisma();
    prisma.run.findMany.mockResolvedValue([
      { ...runRow, id: 'run-1' },
      { ...runRow, id: 'run-2' },
      { ...runRow, id: 'run-3' },
    ]);

    const { items, nextCursor } = await build(prisma).list(org, { limit: 2 });

    expect(items.map((item) => item.id)).toEqual(['run-1', 'run-2']);
    expect(nextCursor).toBe('run-2');
  });

  it('omits the cursor on the last page', async () => {
    const prisma = createPrisma();
    prisma.run.findMany.mockResolvedValue([
      { ...runRow, id: 'run-1' },
      { ...runRow, id: 'run-2' },
    ]);

    const { items, nextCursor } = await build(prisma).list(org, { limit: 2 });

    expect(items).toHaveLength(2);
    expect(nextCursor).toBeUndefined();
  });

  it('resumes after the cursor row instead of repeating it', async () => {
    const prisma = createPrisma();

    await build(prisma).list(org, { limit: 2, cursor: 'run-9' });

    expect(prisma.run.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'run-9' }, skip: 1 }),
    );
  });

  it('counts cases only for the runs on the page', async () => {
    const prisma = createPrisma();
    prisma.run.findMany.mockResolvedValue([
      { ...runRow, id: 'run-1' },
      { ...runRow, id: 'run-2' },
      { ...runRow, id: 'run-3' },
    ]);

    await build(prisma).list(org, { limit: 2 });

    expect(prisma.runCase.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { runId: { in: ['run-1', 'run-2'] } },
      }),
    );
  });

  it('skips the case count query when the page is empty', async () => {
    const prisma = createPrisma();
    prisma.run.findMany.mockResolvedValue([]);

    const { items, nextCursor } = await build(prisma).list(org, { limit: 2 });

    expect(items).toEqual([]);
    expect(nextCursor).toBeUndefined();
    expect(prisma.runCase.groupBy).not.toHaveBeenCalled();
  });

  it('returns case counts instead of the full case list', async () => {
    const prisma = createPrisma();
    prisma.runCase.groupBy.mockResolvedValue([
      { runId: 'run-1', status: 'pass', _count: { _all: 3 } },
      { runId: 'run-1', status: 'fail', _count: { _all: 1 } },
      { runId: 'run-1', status: 'pending', _count: { _all: 2 } },
    ]);

    const {
      items: [summary],
    } = await build(prisma).list(org, {});

    expect(summary).not.toHaveProperty('cases');
    expect(summary.caseCounts).toEqual({
      total: 6,
      pending: 2,
      running: 0,
      pass: 3,
      fail: 1,
      skip: 0,
      blocked: 0,
    });
    expect(summary.passRate).toBeCloseTo(3 / 6);
  });

  it('reports a zero pass rate for a run with no cases', async () => {
    const prisma = createPrisma();
    prisma.runCase.groupBy.mockResolvedValue([]);

    const {
      items: [summary],
    } = await build(prisma).list(org, {});

    expect(summary.caseCounts.total).toBe(0);
    expect(summary.passRate).toBe(0);
  });
});

describe('RunQueriesService.suiteMetrics', () => {
  it('returns an empty item list when the project has no suites', async () => {
    const prisma = createPrisma();
    prisma.suite.findMany.mockResolvedValue([]);

    const result = await build(prisma).suiteMetrics(org, 'project-1');

    expect(result).toEqual({ items: [] });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('scopes the suite lookup to the project and organization', async () => {
    const prisma = createPrisma();

    await build(prisma).suiteMetrics(org, 'project-1');

    expect(prisma.suite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'project-1', organizationId: 'org-1' },
      }),
    );
  });

  it('returns a null lastRun and empty trend for a suite with no runs', async () => {
    const prisma = createPrisma();
    prisma.suite.findMany.mockResolvedValue([
      { id: 'suite-1', name: 'Checkout' },
    ]);
    prisma.$queryRaw.mockResolvedValue([]);

    const result = await build(prisma).suiteMetrics(org, 'project-1');

    expect(result.items).toEqual([
      { suiteId: 'suite-1', suiteName: 'Checkout', lastRun: null, trend: [] },
    ]);
  });

  it('carries the suite name onto the entry so a suite with zero runs still renders its name', async () => {
    const prisma = createPrisma();
    prisma.suite.findMany.mockResolvedValue([
      { id: 'suite-1', name: 'Checkout' },
    ]);
    prisma.$queryRaw.mockResolvedValue([]);

    const result = await build(prisma).suiteMetrics(org, 'project-1');

    expect(result.items[0].suiteName).toBe('Checkout');
  });

  it('builds the lastRun and trend from the ranked runs, with passRate from the case counts', async () => {
    const prisma = createPrisma();
    prisma.suite.findMany.mockResolvedValue([
      { id: 'suite-1', name: 'Checkout' },
    ]);
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'run-2',
        suiteId: 'suite-1',
        status: 'pass',
        source: 'manual',
        startedAt: new Date('2026-01-02T00:00:00.000Z'),
        finishedAt: new Date('2026-01-02T00:05:00.000Z'),
      },
      {
        id: 'run-1',
        suiteId: 'suite-1',
        status: 'fail',
        source: 'manual',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        finishedAt: new Date('2026-01-01T00:05:00.000Z'),
      },
    ]);
    prisma.runCase.groupBy.mockResolvedValue([
      { runId: 'run-2', status: 'pass', _count: { _all: 3 } },
      { runId: 'run-2', status: 'fail', _count: { _all: 1 } },
    ]);

    const result = await build(prisma).suiteMetrics(org, 'project-1');

    expect(result.items).toEqual([
      {
        suiteId: 'suite-1',
        suiteName: 'Checkout',
        lastRun: {
          id: 'run-2',
          status: 'pass',
          source: 'manual',
          startedAt: '2026-01-02T00:00:00.000Z',
          finishedAt: '2026-01-02T00:05:00.000Z',
          passRate: 0.75,
        },
        trend: ['fail', 'pass'],
      },
    ]);
  });

  it('breaks startedAt ties by id, both in the window and the outer order', async () => {
    const prisma = createPrisma();

    await build(prisma).suiteMetrics(org, 'project-1');

    const [[sqlArg]] = prisma.$queryRaw.mock.calls as [[{ sql: string }]];
    const occurrences = sqlArg.sql.match(/"startedAt" DESC, "id" DESC/g) ?? [];
    expect(occurrences).toHaveLength(2);
  });

  it('only counts cases for the most recent run per suite, not every trend run', async () => {
    const prisma = createPrisma();
    prisma.suite.findMany.mockResolvedValue([
      { id: 'suite-1', name: 'Checkout' },
    ]);
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'run-2',
        suiteId: 'suite-1',
        status: 'pass',
        source: 'manual',
        startedAt: new Date('2026-01-02T00:00:00.000Z'),
        finishedAt: new Date('2026-01-02T00:05:00.000Z'),
      },
      {
        id: 'run-1',
        suiteId: 'suite-1',
        status: 'fail',
        source: 'manual',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        finishedAt: new Date('2026-01-01T00:05:00.000Z'),
      },
    ]);

    await build(prisma).suiteMetrics(org, 'project-1');

    expect(prisma.runCase.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { runId: { in: ['run-2'] } } }),
    );
  });
});

function scannedRunRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-2',
    name: 'Checkout regression',
    suiteId: 'suite-1',
    startedAt: new Date('2026-01-02T00:00:00.000Z'),
    finishedAt: new Date('2026-01-02T00:05:00.000Z'),
    suite: { name: 'Checkout' },
    ...overrides,
  };
}

describe('RunQueriesService.regressions', () => {
  it('returns an empty result and scans zero runs when the project has no finished runs', async () => {
    const prisma = createPrisma();
    prisma.run.findMany.mockResolvedValue([]);

    const result = await build(prisma).regressions(org, 'project-1', 20);

    expect(result).toEqual({ items: [], runsScanned: 0 });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.runCase.findMany).not.toHaveBeenCalled();
  });

  it('scopes the scanned runs to finished statuses of the project and organization, ordered and bounded by limit', async () => {
    const prisma = createPrisma();
    prisma.run.findMany.mockResolvedValue([scannedRunRow()]);

    await build(prisma).regressions(org, 'project-1', 20);

    expect(prisma.run.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          projectId: 'project-1',
          status: { in: ['pass', 'fail'] },
          finishedAt: { not: null },
        },
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        take: 20,
      }),
    );
  });

  it('flags a case that passed in the previous finished run of the same suite and now fails', async () => {
    const prisma = createPrisma();
    prisma.run.findMany.mockResolvedValue([scannedRunRow()]);
    prisma.$queryRaw.mockResolvedValue([
      { id: 'run-1', suiteId: 'suite-1', previousId: null },
      { id: 'run-2', suiteId: 'suite-1', previousId: 'run-1' },
    ]);
    prisma.runCase.findMany.mockResolvedValue([
      {
        runId: 'run-1',
        testCaseId: 'case-1',
        name: 'Adds to cart',
        status: 'pass',
      },
      {
        runId: 'run-2',
        testCaseId: 'case-1',
        name: 'Adds to cart',
        status: 'fail',
      },
    ]);

    const result = await build(prisma).regressions(org, 'project-1', 20);

    expect(result).toEqual({
      items: [
        {
          runId: 'run-2',
          runName: 'Checkout regression',
          suiteId: 'suite-1',
          suiteName: 'Checkout',
          testCaseId: 'case-1',
          caseName: 'Adds to cart',
          previousRunId: 'run-1',
          detectedAt: '2026-01-02T00:05:00.000Z',
        },
      ],
      runsScanned: 1,
    });
  });

  it('does not flag a case that was already failing in the previous run', async () => {
    const prisma = createPrisma();
    prisma.run.findMany.mockResolvedValue([scannedRunRow()]);
    prisma.$queryRaw.mockResolvedValue([
      { id: 'run-1', suiteId: 'suite-1', previousId: null },
      { id: 'run-2', suiteId: 'suite-1', previousId: 'run-1' },
    ]);
    prisma.runCase.findMany.mockResolvedValue([
      {
        runId: 'run-1',
        testCaseId: 'case-1',
        name: 'Adds to cart',
        status: 'fail',
      },
      {
        runId: 'run-2',
        testCaseId: 'case-1',
        name: 'Adds to cart',
        status: 'fail',
      },
    ]);

    const result = await build(prisma).regressions(org, 'project-1', 20);

    expect(result.items).toEqual([]);
  });

  it('skips a scanned run that has no previous finished run in the same suite', async () => {
    const prisma = createPrisma();
    prisma.run.findMany.mockResolvedValue([scannedRunRow({ id: 'run-1' })]);
    prisma.$queryRaw.mockResolvedValue([
      { id: 'run-1', suiteId: 'suite-1', previousId: null },
    ]);
    prisma.runCase.findMany.mockResolvedValue([
      {
        runId: 'run-1',
        testCaseId: 'case-1',
        name: 'Adds to cart',
        status: 'fail',
      },
    ]);

    const result = await build(prisma).regressions(org, 'project-1', 20);

    expect(result).toEqual({ items: [], runsScanned: 1 });
  });

  it('reads the previous-run chain and the involved cases with exactly one query each', async () => {
    const prisma = createPrisma();
    prisma.run.findMany.mockResolvedValue([scannedRunRow()]);
    prisma.$queryRaw.mockResolvedValue([
      { id: 'run-1', suiteId: 'suite-1', previousId: null },
      { id: 'run-2', suiteId: 'suite-1', previousId: 'run-1' },
    ]);
    prisma.runCase.findMany.mockResolvedValue([]);

    await build(prisma).regressions(org, 'project-1', 20);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.runCase.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.runCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { runId: { in: ['run-2', 'run-1'] } },
      }),
    );
  });
});

describe('RunQueriesService.findOne', () => {
  it('returns not-found for a run belonging to another organization', async () => {
    const prisma = createPrisma();
    prisma.run.findFirst.mockResolvedValue(null);

    const result = await build(prisma).findOne(org, 'run-1');

    expect(result).toEqual({ ok: false, error: 'not-found' });
    expect(prisma.run.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1', organizationId: 'org-1' },
      }),
    );
  });

  it('returns the run with its cases ordered by position', async () => {
    const prisma = createPrisma();
    prisma.runCase.findMany.mockResolvedValue([
      runCaseRow({ id: 'run-case-2', position: 1 }),
      runCaseRow({ id: 'run-case-1', position: 0 }),
    ]);

    const result = await build(prisma).findOne(org, 'run-1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cases.map((testCase) => testCase.id)).toEqual([
      'run-case-1',
      'run-case-2',
    ]);
  });

  it('projects the linked official case onto the run case', async () => {
    const prisma = createPrisma();
    prisma.runCase.findMany.mockResolvedValue([
      runCaseRow({
        testCaseId: 'case-9',
        testCase: {
          id: 'case-9',
          suiteId: 'suite-1',
          steps: ['Open the cart'],
          expectedResult: 'The cart is empty',
          currentVersion: { version: 3 },
        },
      }),
    ]);

    const result = await build(prisma).findOne(org, 'run-1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cases[0].officialCase).toEqual({
      id: 'case-9',
      suiteId: 'suite-1',
      version: 3,
      steps: ['Open the cart'],
      expectedResult: 'The cart is empty',
    });
  });

  it('reports a null version when the official case has no published version', async () => {
    const prisma = createPrisma();
    prisma.runCase.findMany.mockResolvedValue([
      runCaseRow({
        testCaseId: 'case-9',
        testCase: {
          id: 'case-9',
          suiteId: 'suite-1',
          steps: [],
          expectedResult: '',
          currentVersion: null,
        },
      }),
    ]);

    const result = await build(prisma).findOne(org, 'run-1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cases[0].officialCase?.version).toBeNull();
  });

  it('leaves officialCase null when the run case is not linked', async () => {
    const prisma = createPrisma();
    prisma.runCase.findMany.mockResolvedValue([
      runCaseRow({ testCaseId: null, testCase: null }),
    ]);

    const result = await build(prisma).findOne(org, 'run-1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cases[0].officialCase).toBeNull();
  });
});

describe('RunQueriesService.createManual', () => {
  const input: CreateManualRunInput = {
    projectId: 'project-1',
    suiteId: 'suite-1',
  };

  it('returns suite-not-found when the suite is outside the project or organization', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue(null);

    const result = await build(prisma).createManual(org, user, input);

    expect(result).toEqual({ ok: false, error: 'suite-not-found' });
    expect(prisma.run.create).not.toHaveBeenCalled();
  });

  it('rejects a suite with zero cases', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue({ ...suiteWithCases, cases: [] });

    const result = await build(prisma).createManual(org, user, input);

    expect(result).toEqual({ ok: false, error: 'no-manual-cases' });
    expect(prisma.run.create).not.toHaveBeenCalled();
  });

  it('rejects a suite that has only draft cases as having no manual cases', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue({ ...suiteWithCases, cases: [] });

    const result = await build(prisma).createManual(org, user, input);

    expect(result).toEqual({ ok: false, error: 'no-manual-cases' });
    expect(prisma.suite.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          cases: expect.objectContaining({
            where: { state: 'active', executionMode: 'manual' },
          }) as unknown,
        }) as unknown,
      }),
    );
  });

  it('rejects a suite that has only automated cases as having no manual cases', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue({ ...suiteWithCases, cases: [] });

    const result = await build(prisma).createManual(org, user, input);

    expect(result).toEqual({ ok: false, error: 'no-manual-cases' });
    expect(prisma.run.create).not.toHaveBeenCalled();
  });

  it('only snapshots active, manual cases, excluding drafts and automated cases from the official run', async () => {
    const prisma = createPrisma();

    await build(prisma).createManual(org, user, input);

    expect(prisma.suite.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          cases: expect.objectContaining({
            where: { state: 'active', executionMode: 'manual' },
          }) as unknown,
        }) as unknown,
      }),
    );
  });

  function createDataOf(prisma: FakePrisma): Record<string, unknown> {
    const [[call]] = prisma.run.create.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    return call.data;
  }

  it('creates the run as manual, pending, with the caller as executedBy', async () => {
    const prisma = createPrisma();

    await build(prisma).createManual(org, user, input);

    expect(createDataOf(prisma)).toEqual(
      expect.objectContaining({
        projectId: 'project-1',
        organizationId: 'org-1',
        suiteId: 'suite-1',
        source: 'manual',
        externalId: null,
        status: 'pending',
        executedById: 'user-1',
      }),
    );
  });

  it('defaults the run name to the suite name when none is given', async () => {
    const prisma = createPrisma();

    await build(prisma).createManual(org, user, input);

    expect(createDataOf(prisma)).toEqual(
      expect.objectContaining({ name: 'Checkout' }),
    );
  });

  it('uses the given name when provided', async () => {
    const prisma = createPrisma();

    await build(prisma).createManual(org, user, { ...input, name: 'Smoke' });

    expect(createDataOf(prisma)).toEqual(
      expect.objectContaining({ name: 'Smoke' }),
    );
  });

  it('snapshots every case from the suite with sequential positions and pending status', async () => {
    const prisma = createPrisma();

    await build(prisma).createManual(org, user, input);

    expect(prisma.runCase.createManyAndReturn).toHaveBeenCalledTimes(1);
    const [call] = prisma.runCase.createManyAndReturn.mock.calls as [
      [
        {
          data: {
            testCaseId: string;
            name: string;
            steps: string[];
            expectedResult: string;
            status: string;
            position: number;
          }[];
        },
      ],
    ];

    expect(call[0].data).toEqual([
      expect.objectContaining({
        testCaseId: 'case-1',
        name: 'Adds to cart',
        steps: ['open', 'add'],
        expectedResult: 'cart has one item',
        status: 'pending',
        position: 0,
      }),
      expect.objectContaining({
        testCaseId: 'case-2',
        name: 'Removes from cart',
        steps: ['open', 'remove'],
        expectedResult: 'cart is empty',
        status: 'pending',
        position: 1,
      }),
    ]);
  });

  it('projects the linked official case onto the response, since createManyAndReturn cannot select nested relations', async () => {
    const prisma = createPrisma();
    prisma.txRunCaseFindMany.mockResolvedValue([
      runCaseRow({
        testCaseId: 'case-1',
        testCase: {
          id: 'case-1',
          suiteId: 'suite-1',
          steps: ['open', 'add'],
          expectedResult: 'cart has one item',
          currentVersion: null,
        },
      }),
    ]);

    const result = await build(prisma).createManual(org, user, input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cases[0].officialCase).not.toBeNull();
    expect(result.value.cases[0].officialCase?.id).toBe('case-1');
    expect(result.value.cases[0].officialCase?.version).toBeNull();
  });

  it('reloads the created run cases from the transaction client, not the outer prisma client', async () => {
    const prisma = createPrisma();

    await build(prisma).createManual(org, user, input);

    expect(prisma.txRunCaseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { runId: 'run-1' } }),
    );
    expect(prisma.runCase.findMany).not.toHaveBeenCalled();
  });

  it('creates two manual runs for the same project without colliding on the null externalId', async () => {
    const prisma = createPrisma();
    const service = build(prisma);

    const first = await service.createManual(org, user, input);
    const second = await service.createManual(org, user, input);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(prisma.run.create).toHaveBeenCalledTimes(2);

    const calls = prisma.run.create.mock.calls as [
      { data: Record<string, unknown> },
    ][];
    expect(calls[0][0].data).toEqual(
      expect.objectContaining({ externalId: null }),
    );
    expect(calls[1][0].data).toEqual(
      expect.objectContaining({ externalId: null }),
    );
  });
});

describe('RunQueriesService.updateCaseStatus', () => {
  it('refuses to edit a case in a run reported by CI', async () => {
    const prisma = createPrisma();
    prisma.run.findFirst.mockResolvedValue({
      ...runRow,
      source: 'github_actions',
    });

    const result = await build(prisma).updateCaseStatus(
      org,
      'run-1',
      'case-1',
      {
        status: 'pass',
      },
    );

    expect(result).toEqual({ ok: false, error: 'source-not-editable' });
    expect(prisma.runCase.update).not.toHaveBeenCalled();
  });

  it('refuses to edit a case in a run ingested through the api', async () => {
    const prisma = createPrisma();
    prisma.run.findFirst.mockResolvedValue({ ...runRow, source: 'api' });

    const result = await build(prisma).updateCaseStatus(
      org,
      'run-1',
      'case-1',
      {
        status: 'pass',
      },
    );

    expect(result).toEqual({ ok: false, error: 'source-not-editable' });
    expect(prisma.runCase.update).not.toHaveBeenCalled();
  });

  it('still edits a case in a manual run', async () => {
    const prisma = createPrisma();
    prisma.run.findFirst.mockResolvedValue({ ...runRow, source: 'manual' });

    const result = await build(prisma).updateCaseStatus(
      org,
      'run-1',
      'run-case-1',
      {
        status: 'pass',
      },
    );

    expect(result.ok).toBe(true);
    expect(prisma.runCase.update).toHaveBeenCalled();
  });

  it('returns not-found when the run belongs to another organization', async () => {
    const prisma = createPrisma();
    prisma.run.findFirst.mockResolvedValue(null);

    const result = await build(prisma).updateCaseStatus(
      org,
      'run-1',
      'run-case-1',
      { status: 'pass' },
    );

    expect(result).toEqual({ ok: false, error: 'not-found' });
  });

  it('returns case-not-found when the case does not belong to the run', async () => {
    const prisma = createPrisma();
    prisma.runCase.findMany.mockResolvedValue([]);

    const result = await build(prisma).updateCaseStatus(
      org,
      'run-1',
      'run-case-missing',
      { status: 'pass' },
    );

    expect(result).toEqual({ ok: false, error: 'case-not-found' });
    expect(prisma.runCase.update).not.toHaveBeenCalled();
  });

  it('records the recordedAt timestamp on the updated case', async () => {
    const prisma = createPrisma();
    prisma.runCase.findMany
      .mockResolvedValueOnce([runCaseRow({ id: 'run-case-1' })])
      .mockResolvedValue([runCaseRow({ id: 'run-case-1', status: 'pass' })]);

    await build(prisma).updateCaseStatus(org, 'run-1', 'run-case-1', {
      status: 'pass',
    });

    const [[call]] = prisma.runCase.update.mock.calls as [
      [{ where: { id: string }; data: Record<string, unknown> }],
    ];
    expect(call.where).toEqual({ id: 'run-case-1' });
    expect(call.data).toEqual(
      expect.objectContaining({
        status: 'pass',
        recordedAt: expect.any(Date) as Date,
      }),
    );
  });

  it('keeps the run running while a case is still pending', async () => {
    const prisma = createPrisma();
    prisma.runCase.findMany
      .mockResolvedValueOnce([runCaseRow({ id: 'run-case-1' })])
      .mockResolvedValueOnce([
        runCaseRow({ id: 'run-case-1', status: 'pass' }),
        runCaseRow({ id: 'run-case-2', status: 'pending' }),
      ])
      .mockResolvedValue([
        runCaseRow({ id: 'run-case-1', status: 'pass' }),
        runCaseRow({ id: 'run-case-2', status: 'pending' }),
      ]);

    await build(prisma).updateCaseStatus(org, 'run-1', 'run-case-1', {
      status: 'pass',
    });

    const [[call]] = prisma.run.update.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(call.data).toEqual(expect.objectContaining({ status: 'running' }));
    expect(call.data).not.toHaveProperty('finishedAt');
  });

  it('finishes the run and sets finishedAt when no case remains pending or running', async () => {
    const prisma = createPrisma();
    prisma.runCase.findMany
      .mockResolvedValueOnce([runCaseRow({ id: 'run-case-1' })])
      .mockResolvedValueOnce([runCaseRow({ id: 'run-case-1', status: 'pass' })])
      .mockResolvedValue([runCaseRow({ id: 'run-case-1', status: 'pass' })]);

    await build(prisma).updateCaseStatus(org, 'run-1', 'run-case-1', {
      status: 'pass',
    });

    const [[call]] = prisma.run.update.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(call.data).toEqual(
      expect.objectContaining({
        status: 'pass',
        finishedAt: expect.any(Date) as Date,
      }),
    );
  });

  it('does not overwrite finishedAt once the run has already finished', async () => {
    const prisma = createPrisma();
    prisma.run.findFirst.mockResolvedValue({
      ...runRow,
      finishedAt: new Date('2026-01-01T01:00:00.000Z'),
    });
    prisma.runCase.findMany
      .mockResolvedValueOnce([runCaseRow({ id: 'run-case-1' })])
      .mockResolvedValueOnce([runCaseRow({ id: 'run-case-1', status: 'pass' })])
      .mockResolvedValue([runCaseRow({ id: 'run-case-1', status: 'pass' })]);

    await build(prisma).updateCaseStatus(org, 'run-1', 'run-case-1', {
      status: 'pass',
    });

    const [call] = prisma.run.update.mock.calls as [{ data: object }][];
    expect(call[0].data).not.toHaveProperty('finishedAt');
  });

  it('returns the updated run with its cases', async () => {
    const prisma = createPrisma();
    prisma.runCase.findMany
      .mockResolvedValueOnce([runCaseRow({ id: 'run-case-1' })])
      .mockResolvedValue([runCaseRow({ id: 'run-case-1', status: 'pass' })]);

    const result = await build(prisma).updateCaseStatus(
      org,
      'run-1',
      'run-case-1',
      { status: 'pass' },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cases).toHaveLength(1);
  });
});

function findFirstByQueryShape(
  scopedValue: unknown,
  previousRunValue: unknown,
) {
  return (args: { where: Record<string, unknown> }) =>
    Promise.resolve('suiteId' in args.where ? previousRunValue : scopedValue);
}

describe('RunQueriesService.updateCaseStatus terminal notifications', () => {
  it('publishes run_failed when the run transitions into fail', async () => {
    const prisma = createPrisma();
    const notifications = createNotifications();
    prisma.run.findFirst.mockImplementation(
      findFirstByQueryShape(runRow, null),
    );
    prisma.runCase.findMany
      .mockResolvedValueOnce([runCaseRow({ id: 'run-case-1' })])
      .mockResolvedValue([runCaseRow({ id: 'run-case-1', status: 'fail' })]);
    prisma.run.update.mockResolvedValue({ ...runRow, status: 'fail' });

    await build(prisma, notifications).updateCaseStatus(
      org,
      'run-1',
      'run-case-1',
      { status: 'fail' },
    );

    expect(notifications.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'run_failed',
        dedupeKey: 'run_failed:run-1',
      }),
    );
  });

  it('publishes run_completed when the run transitions into pass', async () => {
    const prisma = createPrisma();
    const notifications = createNotifications();
    prisma.runCase.findMany
      .mockResolvedValueOnce([runCaseRow({ id: 'run-case-1' })])
      .mockResolvedValue([runCaseRow({ id: 'run-case-1', status: 'pass' })]);
    prisma.run.update.mockResolvedValue({ ...runRow, status: 'pass' });

    await build(prisma, notifications).updateCaseStatus(
      org,
      'run-1',
      'run-case-1',
      { status: 'pass' },
    );

    expect(notifications.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'run_completed',
        dedupeKey: 'run_completed:run-1',
      }),
    );
  });

  it('does not publish when the derived status does not change', async () => {
    const prisma = createPrisma();
    const notifications = createNotifications();
    prisma.runCase.findMany
      .mockResolvedValueOnce([runCaseRow({ id: 'run-case-1' })])
      .mockResolvedValue([runCaseRow({ id: 'run-case-1', status: 'pending' })]);
    prisma.run.update.mockResolvedValue({ ...runRow, status: 'pending' });

    await build(prisma, notifications).updateCaseStatus(
      org,
      'run-1',
      'run-case-1',
      { status: 'pass' },
    );

    expect(notifications.publish).not.toHaveBeenCalled();
  });
});

describe('RunQueriesService.updateCaseStatus regression notifications', () => {
  it('publishes case_regressed when the same case passed in the previous finished run', async () => {
    const prisma = createPrisma();
    const notifications = createNotifications();
    prisma.run.findFirst.mockImplementation(
      findFirstByQueryShape(runRow, { id: 'run-0' }),
    );
    prisma.runCase.findMany
      .mockResolvedValueOnce([
        runCaseRow({ id: 'run-case-1', testCaseId: 'case-1' }),
      ])
      .mockResolvedValueOnce([{ testCaseId: 'case-1', status: 'pass' }])
      .mockResolvedValue([
        runCaseRow({ id: 'run-case-1', testCaseId: 'case-1', status: 'fail' }),
      ]);

    await build(prisma, notifications).updateCaseStatus(
      org,
      'run-1',
      'run-case-1',
      { status: 'fail' },
    );

    expect(notifications.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'case_regressed',
        dedupeKey: 'case_regressed:run-1:case-1',
        testCaseId: 'case-1',
      }),
    );
  });

  it('does not publish case_regressed when there is no previous finished run', async () => {
    const prisma = createPrisma();
    const notifications = createNotifications();
    prisma.run.findFirst.mockImplementation(
      findFirstByQueryShape(runRow, null),
    );
    prisma.runCase.findMany
      .mockResolvedValueOnce([
        runCaseRow({ id: 'run-case-1', testCaseId: 'case-1' }),
      ])
      .mockResolvedValue([
        runCaseRow({ id: 'run-case-1', testCaseId: 'case-1', status: 'fail' }),
      ]);

    await build(prisma, notifications).updateCaseStatus(
      org,
      'run-1',
      'run-case-1',
      { status: 'fail' },
    );

    const regressionCalls = notifications.publish.mock.calls.filter(
      ([event]: [{ eventType: string }]) =>
        event.eventType === 'case_regressed',
    );
    expect(regressionCalls).toHaveLength(0);
  });

  it('does not publish case_regressed when the previous run case was not pass', async () => {
    const prisma = createPrisma();
    const notifications = createNotifications();
    prisma.run.findFirst.mockImplementation(
      findFirstByQueryShape(runRow, { id: 'run-0' }),
    );
    prisma.runCase.findMany
      .mockResolvedValueOnce([
        runCaseRow({ id: 'run-case-1', testCaseId: 'case-1' }),
      ])
      .mockResolvedValueOnce([{ testCaseId: 'case-1', status: 'fail' }])
      .mockResolvedValue([
        runCaseRow({ id: 'run-case-1', testCaseId: 'case-1', status: 'fail' }),
      ]);

    await build(prisma, notifications).updateCaseStatus(
      org,
      'run-1',
      'run-case-1',
      { status: 'fail' },
    );

    const regressionCalls = notifications.publish.mock.calls.filter(
      ([event]: [{ eventType: string }]) =>
        event.eventType === 'case_regressed',
    );
    expect(regressionCalls).toHaveLength(0);
  });

  it('does not check regression when the case does not transition to fail', async () => {
    const prisma = createPrisma();
    const notifications = createNotifications();
    prisma.run.findFirst.mockImplementation(
      findFirstByQueryShape(runRow, null),
    );
    prisma.runCase.findMany
      .mockResolvedValueOnce([runCaseRow({ id: 'run-case-1' })])
      .mockResolvedValue([runCaseRow({ id: 'run-case-1', status: 'pass' })]);

    await build(prisma, notifications).updateCaseStatus(
      org,
      'run-1',
      'run-case-1',
      { status: 'pass' },
    );

    expect(prisma.run.findFirst).toHaveBeenCalledTimes(1);
  });
});

describe('RunQueriesService.list delta', () => {
  const previousRow = {
    ...runRow,
    id: 'run-0',
    startedAt: new Date('2025-12-31T00:00:00.000Z'),
  };

  it('reports no delta for a run whose suite has no earlier finished run', async () => {
    const prisma = createPrisma();
    prisma.$queryRaw.mockResolvedValue([
      { id: 'run-1', suiteId: 'suite-1', previousId: null },
    ]);

    const { items } = await build(prisma).list(org, { projectId: 'project-1' });

    expect(items[0].delta).toBeNull();
    expect(prisma.runCase.findMany).not.toHaveBeenCalled();
  });

  it('counts regressions, fixes and unchanged cases against the previous run of the same suite', async () => {
    const prisma = createPrisma();
    prisma.run.findMany.mockResolvedValue([runRow, previousRow]);
    prisma.$queryRaw.mockResolvedValue([
      { id: 'run-0', suiteId: 'suite-1', previousId: null },
      { id: 'run-1', suiteId: 'suite-1', previousId: 'run-0' },
    ]);
    prisma.runCase.findMany.mockResolvedValue([
      { runId: 'run-0', testCaseId: 'case-1', name: 'Adds', status: 'pass' },
      { runId: 'run-0', testCaseId: 'case-2', name: 'Removes', status: 'fail' },
      { runId: 'run-0', testCaseId: 'case-3', name: 'Lists', status: 'pass' },
      { runId: 'run-1', testCaseId: 'case-1', name: 'Adds', status: 'fail' },
      { runId: 'run-1', testCaseId: 'case-2', name: 'Removes', status: 'pass' },
      { runId: 'run-1', testCaseId: 'case-3', name: 'Lists', status: 'pass' },
      { runId: 'run-1', testCaseId: 'case-4', name: 'Pays', status: 'pass' },
    ]);

    const { items } = await build(prisma).list(org, { projectId: 'project-1' });

    expect(items[0].delta).toEqual({ regressions: 1, fixes: 1, unchanged: 1 });
    expect(items[1].delta).toBeNull();
  });

  it('resolves previous runs with one window query over the listed suites and one case read', async () => {
    const prisma = createPrisma();
    prisma.run.findMany.mockResolvedValue([runRow, previousRow]);
    prisma.$queryRaw.mockResolvedValue([
      { id: 'run-1', suiteId: 'suite-1', previousId: 'run-0' },
    ]);
    prisma.runCase.findMany.mockResolvedValue([]);

    await build(prisma).list(org, { projectId: 'project-1' });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const [sqlArg] = prisma.$queryRaw.mock.calls[0] as [{ sql: string }];
    expect(sqlArg.sql).toContain('LAG(id) OVER');
    expect(prisma.runCase.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.runCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          runId: { in: expect.arrayContaining(['run-1', 'run-0']) as unknown },
        },
      }),
    );
  });
});

describe('RunQueriesService.findOne delta', () => {
  const finishedRow = {
    ...runRow,
    status: 'pass' as const,
    finishedAt: new Date('2026-01-01T01:00:00.000Z'),
  };

  it('reports no delta and asks for no predecessor while the run is still open', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).findOne(org, 'run-1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.delta).toBeNull();
    expect(prisma.run.findFirst).toHaveBeenCalledTimes(1);
  });

  it('reports no delta when the suite has no earlier finished run', async () => {
    const prisma = createPrisma();
    prisma.run.findFirst
      .mockResolvedValueOnce(finishedRow)
      .mockResolvedValueOnce(null);

    const result = await build(prisma).findOne(org, 'run-1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.delta).toBeNull();
    expect(prisma.run.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          suiteId: 'suite-1',
          organizationId: 'org-1',
          status: { in: ['pass', 'fail'] },
          finishedAt: { not: null },
          OR: [
            { startedAt: { lt: finishedRow.startedAt } },
            { startedAt: finishedRow.startedAt, id: { lt: finishedRow.id } },
          ],
        }) as unknown,
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('lists the regressed and fixed cases by name against the previous run', async () => {
    const prisma = createPrisma();
    prisma.run.findFirst
      .mockResolvedValueOnce(finishedRow)
      .mockResolvedValueOnce({ id: 'run-0' });
    prisma.runCase.findMany
      .mockResolvedValueOnce([
        runCaseRow({
          id: 'rc-1',
          testCaseId: 'case-1',
          name: 'Adds',
          status: 'fail',
          position: 0,
        }),
        runCaseRow({
          id: 'rc-2',
          testCaseId: 'case-2',
          name: 'Removes',
          status: 'pass',
          position: 1,
        }),
        runCaseRow({
          id: 'rc-3',
          testCaseId: 'case-3',
          name: 'Lists',
          status: 'pass',
          position: 2,
        }),
      ])
      .mockResolvedValueOnce([
        { testCaseId: 'case-1', status: 'pass' },
        { testCaseId: 'case-2', status: 'fail' },
        { testCaseId: 'case-3', status: 'pass' },
      ]);

    const result = await build(prisma).findOne(org, 'run-1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.delta).toEqual({
      regressions: [{ testCaseId: 'case-1', caseName: 'Adds' }],
      fixes: [{ testCaseId: 'case-2', caseName: 'Removes' }],
    });
  });
});
