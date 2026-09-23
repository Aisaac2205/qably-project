import { Prisma } from '../../../generated/prisma/client';
import type { OrgContext } from '../organizations/organizations.contracts';
import { OverviewService } from './overview.service';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'member',
};

const NOW = new Date('2026-06-16T11:00:00.000Z');

interface FakePrisma {
  project: { findFirst: jest.Mock; findMany: jest.Mock };
  suite: { groupBy: jest.Mock };
  testCase: { groupBy: jest.Mock };
  run: { groupBy: jest.Mock; findMany: jest.Mock };
  runCase: { groupBy: jest.Mock };
  $queryRaw: jest.Mock;
}

function createPrisma(): FakePrisma {
  return {
    project: {
      findFirst: jest.fn().mockResolvedValue({ id: 'project-1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    suite: { groupBy: jest.fn().mockResolvedValue([]) },
    testCase: { groupBy: jest.fn().mockResolvedValue([]) },
    run: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    runCase: { groupBy: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
}

function build(prisma: FakePrisma) {
  return new OverviewService(prisma as never);
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick'] });
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('OverviewService organization scope', () => {
  it('scopes the project, suite and test case queries to the caller organization when no project is given', async () => {
    const prisma = createPrisma();

    await build(prisma).overview(org, 7, 'UTC');

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
      }),
    );
    expect(prisma.suite.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
      }),
    );
    expect(prisma.run.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
      }),
    );
  });

  it('never looks up a single project when none is requested', async () => {
    const prisma = createPrisma();

    await build(prisma).overview(org, 7, 'UTC');

    expect(prisma.project.findFirst).not.toHaveBeenCalled();
  });

  it('caps recentRuns at 4, most recent first', async () => {
    const prisma = createPrisma();

    await build(prisma).overview(org, 7, 'UTC');

    expect(prisma.run.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 4,
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });
});

describe('OverviewService project scope', () => {
  it('returns project-not-found for a project outside the organization', async () => {
    const prisma = createPrisma();
    prisma.project.findFirst.mockResolvedValue(null);

    const result = await build(prisma).overview(org, 7, 'UTC', 'project-x');

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBe('project-not-found');
  });

  it('scopes every query to the given project once it is confirmed in scope', async () => {
    const prisma = createPrisma();

    await build(prisma).overview(org, 7, 'UTC', 'project-1');

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', id: 'project-1' },
      }),
    );
    expect(prisma.run.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', projectId: 'project-1' },
      }),
    );
  });
});

describe('OverviewService empty organization', () => {
  it('reports zero/null KPIs and empty lists without crashing', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).overview(org, 7, 'UTC');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.kpis.passRate.value).toBeNull();
    expect(result.value.kpis.runs.value).toBe(0);
    expect(result.value.kpis.failedCases.value).toBe(0);
    expect(result.value.kpis.avgRunDurationMs.value).toBeNull();
    expect(result.value.projects).toEqual([]);
    expect(result.value.recentRuns).toEqual([]);
    expect(result.value.casesPassing).toEqual({
      total: 0,
      pending: 0,
      running: 0,
      pass: 0,
      fail: 0,
      skip: 0,
      blocked: 0,
    });
  });
});

describe('OverviewService time zone errors', () => {
  it('maps an unknown-Postgres-zone rejection to invalid-time-zone', async () => {
    const prisma = createPrisma();
    prisma.$queryRaw.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Raw query failed. Code: `22023`.',
        {
          code: 'P2010',
          clientVersion: '7.0.0',
          meta: {
            code: '22023',
            message: 'invalid input syntax for type timestamp with time zone',
          },
        },
      ),
    );

    const result = await build(prisma).overview(org, 7, 'America/Guatemala');

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBe('invalid-time-zone');
  });

  it('rethrows an unrelated database error', async () => {
    const prisma = createPrisma();
    const dbError = new Error('connection reset');
    prisma.$queryRaw.mockRejectedValue(dbError);

    await expect(build(prisma).overview(org, 7, 'UTC')).rejects.toBe(dbError);
  });
});
