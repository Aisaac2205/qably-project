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
  suite: { findFirst: jest.Mock };
  $transaction: jest.Mock;
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
    suite: { findFirst: jest.fn().mockResolvedValue(suiteWithCases) },
    $transaction: jest.fn(),
  };

  prisma.$transaction.mockImplementation((run: (tx: FakePrisma) => unknown) =>
    run(prisma),
  );

  return prisma;
}

function build(prisma: FakePrisma) {
  return new RunQueriesService(prisma as never);
}

describe('RunQueriesService.list', () => {
  it('scopes runs to the caller organization', async () => {
    const prisma = createPrisma();

    await build(prisma).list(org);

    expect(prisma.run.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
      }),
    );
  });

  it('filters by project when a projectId is given', async () => {
    const prisma = createPrisma();

    await build(prisma).list(org, 'project-1');

    expect(prisma.run.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', projectId: 'project-1' },
      }),
    );
  });

  it('orders runs by startedAt descending', async () => {
    const prisma = createPrisma();

    await build(prisma).list(org);

    expect(prisma.run.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { startedAt: 'desc' },
      }),
    );
  });

  it('returns case counts instead of the full case list', async () => {
    const prisma = createPrisma();
    prisma.runCase.groupBy.mockResolvedValue([
      { runId: 'run-1', status: 'pass', _count: { _all: 3 } },
      { runId: 'run-1', status: 'fail', _count: { _all: 1 } },
      { runId: 'run-1', status: 'pending', _count: { _all: 2 } },
    ]);

    const [summary] = await build(prisma).list(org);

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

    const [summary] = await build(prisma).list(org);

    expect(summary.caseCounts.total).toBe(0);
    expect(summary.passRate).toBe(0);
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

    expect(result).toEqual({ ok: false, error: 'empty-suite' });
    expect(prisma.run.create).not.toHaveBeenCalled();
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
