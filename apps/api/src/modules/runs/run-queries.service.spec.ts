import type { OrgContext } from '../organizations/organizations.contracts';
import { RunQueriesService } from './run-queries.service';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'member',
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

interface FakePrisma {
  run: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
  runCase: {
    findMany: jest.Mock;
    groupBy: jest.Mock;
  };
}

function createPrisma(): FakePrisma {
  return {
    run: {
      findMany: jest.fn().mockResolvedValue([runRow]),
      findFirst: jest.fn().mockResolvedValue(runRow),
    },
    runCase: {
      findMany: jest.fn().mockResolvedValue([runCaseRow()]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
  };
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
