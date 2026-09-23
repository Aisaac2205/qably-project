import { Prisma } from '../../../generated/prisma/client';
import { RECENT_ACTIVITY_LIMIT } from '../../common/metrics/recent-activity';
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
  run: { groupBy: jest.Mock };
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
    },
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
  });

  it('never looks up a single project when none is requested', async () => {
    const prisma = createPrisma();

    await build(prisma).overview(org, 7, 'UTC');

    expect(prisma.project.findFirst).not.toHaveBeenCalled();
  });
});

describe('OverviewService casesPassing query scoping', () => {
  it('scopes the casesPassing CTE to the organization on the run side too (defense in depth)', async () => {
    const prisma = createPrisma();

    await build(prisma).overview(org, 7, 'UTC');

    const casesPassingCall = prisma.$queryRaw.mock.calls.find(
      ([sql]: [{ strings: string[] }]) =>
        sql.strings.join('').includes('WITH latest'),
    ) as [{ strings: string[]; values: unknown[] }] | undefined;

    expect(casesPassingCall).toBeDefined();
    const sqlText = casesPassingCall?.[0].strings.join('') ?? '';
    expect(sqlText).toContain('r."organizationId"');
    expect(casesPassingCall?.[0].values).toEqual(
      expect.arrayContaining(['org-1']),
    );
  });

  it('scopes the casesPassing CTE to the given project on the run side when a project is requested', async () => {
    const prisma = createPrisma();

    await build(prisma).overview(org, 7, 'UTC', 'project-1');

    const casesPassingCall = prisma.$queryRaw.mock.calls.find(
      ([sql]: [{ strings: string[] }]) =>
        sql.strings.join('').includes('WITH latest'),
    ) as [{ strings: string[]; values: unknown[] }] | undefined;

    expect(casesPassingCall).toBeDefined();
    const sqlText = casesPassingCall?.[0].strings.join('') ?? '';
    expect(sqlText).toContain('r."projectId"');
    expect(casesPassingCall?.[0].values).toEqual(
      expect.arrayContaining(['org-1', 'project-1']),
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
    expect(result.value.recentActivity).toEqual([]);
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

function findQueryRawCall(
  prisma: FakePrisma,
  marker: string,
): { strings: string[]; values: unknown[] } | undefined {
  const calls = prisma.$queryRaw.mock.calls as [
    { strings: string[]; values: unknown[] },
  ][];
  const match = calls.find(([sql]) => sql.strings.join('').includes(marker));

  return match?.[0];
}

describe('OverviewService recentActivity query scoping', () => {
  it('bounds the activity_candidates query to the organization and the period window, not an arbitrary row cap', async () => {
    const prisma = createPrisma();

    await build(prisma).overview(org, 7, 'UTC');

    const call = findQueryRawCall(prisma, 'activity_candidates');

    expect(call).toBeDefined();
    const sqlText = call?.strings.join('') ?? '';
    expect(sqlText).toContain('r."organizationId"');
    expect(sqlText).toContain('r."startedAt" >=');
    expect(sqlText).toContain('r."startedAt" <');
    expect(sqlText).toContain('LIMIT');
    expect(sqlText).not.toContain('200');
    expect(call?.values).toEqual(
      expect.arrayContaining([
        'org-1',
        new Date('2026-06-10T00:00:00.000Z'),
        NOW,
        RECENT_ACTIVITY_LIMIT,
      ]),
    );
  });

  it('scopes the activity_candidates query to the given project when one is requested', async () => {
    const prisma = createPrisma();

    await build(prisma).overview(org, 7, 'UTC', 'project-1');

    const call = findQueryRawCall(prisma, 'activity_candidates');

    expect(call).toBeDefined();
    const sqlText = call?.strings.join('') ?? '';
    expect(sqlText).toContain('r."projectId"');
    expect(call?.values).toEqual(
      expect.arrayContaining(['org-1', 'project-1']),
    );
  });

  it('groups candidates by project + commit, or by run id when commitSha is null', async () => {
    const prisma = createPrisma();

    await build(prisma).overview(org, 7, 'UTC');

    const call = findQueryRawCall(prisma, 'activity_candidates');
    const sqlText = call?.strings.join('') ?? '';

    expect(sqlText).toContain(
      'COALESCE(r."commitSha", r.id::text) AS "activityKey"',
    );
    expect(sqlText).toContain('GROUP BY "projectId", "activityKey"');
    expect(sqlText).toContain('ORDER BY MAX("startedAt") DESC');
  });

  it('skips the bounded aggregate query entirely when no candidates are found', async () => {
    const prisma = createPrisma();

    await build(prisma).overview(org, 7, 'UTC');

    const aggregateCall = findQueryRawCall(prisma, 'matched_runs');
    expect(aggregateCall).toBeUndefined();
  });

  it('never fetches raw run rows for the aggregate: it queries matched_runs, never a full commit fetch', async () => {
    const prisma = createPrisma();
    prisma.$queryRaw.mockImplementation((sql: { strings: string[] }) => {
      const text = sql.strings.join('');
      if (text.includes('activity_candidates')) {
        return Promise.resolve([
          {
            projectId: 'project-1',
            activityKey: 'd2f363de80e51157947e36f40d2965404e162b21',
            commitSha: 'd2f363de80e51157947e36f40d2965404e162b21',
            lastActivityAt: new Date('2026-06-16T10:00:00.000Z'),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    await build(prisma).overview(org, 7, 'UTC');

    const aggregateCall = findQueryRawCall(prisma, 'matched_runs');
    expect(aggregateCall).toBeDefined();
    const sqlText = aggregateCall?.strings.join('') ?? '';
    expect(sqlText).toContain('DISTINCT ON');
    expect(sqlText).toContain('"run_case" rc');
    expect(sqlText).toContain(
      '(r."projectId", COALESCE(r."commitSha", r.id::text)) IN',
    );
    expect(sqlText).toContain(
      'array_agg(DISTINCT mr.status)::text[] AS "statuses"',
    );
  });

  it('bounds the aggregate query to the same period window as the candidates query', async () => {
    const prisma = createPrisma();
    prisma.$queryRaw.mockImplementation((sql: { strings: string[] }) => {
      const text = sql.strings.join('');
      if (text.includes('activity_candidates')) {
        return Promise.resolve([
          {
            projectId: 'project-1',
            activityKey: 'run-standalone',
            commitSha: null,
            lastActivityAt: new Date('2026-06-16T10:00:00.000Z'),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    await build(prisma).overview(org, 7, 'UTC');

    const aggregateCall = findQueryRawCall(prisma, 'matched_runs');
    const sqlText = aggregateCall?.strings.join('') ?? '';
    expect(sqlText).toContain('r."startedAt" >=');
    expect(sqlText).toContain('r."startedAt" <');
    expect(aggregateCall?.values).toEqual(
      expect.arrayContaining([
        new Date('2026-06-10T00:00:00.000Z'),
        NOW,
        'project-1',
        'run-standalone',
      ]),
    );
  });

  it('fetches the bounded aggregate rows for the chosen activity groups and maps them to recentActivity', async () => {
    const prisma = createPrisma();
    prisma.$queryRaw.mockImplementation((sql: { strings: string[] }) => {
      const text = sql.strings.join('');
      if (text.includes('activity_candidates')) {
        return Promise.resolve([
          {
            projectId: 'project-1',
            activityKey: 'd2f363de80e51157947e36f40d2965404e162b21',
            commitSha: 'd2f363de80e51157947e36f40d2965404e162b21',
            lastActivityAt: new Date('2026-06-16T10:10:00.000Z'),
          },
        ]);
      }
      if (text.includes('matched_runs')) {
        return Promise.resolve([
          {
            projectId: 'project-1',
            activityKey: 'd2f363de80e51157947e36f40d2965404e162b21',
            commitSha: 'd2f363de80e51157947e36f40d2965404e162b21',
            suiteCount: 2,
            statuses: ['fail', 'running'],
            anchorRunId: 'run-2',
            anchorRunName: 'Nightly regression',
            anchorSuiteName: 'Checkout suite',
            anchorSource: 'github_actions',
            anchorStartedAt: new Date('2026-06-16T10:10:00.000Z'),
            anchorCommitMessage: 'fix(ci): retry throttled run reports',
            anchorCommitAuthor: 'Aisaac2205',
            projectName: 'Checkout',
            casesPassed: 2,
            casesTotal: 3,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await build(prisma).overview(org, 7, 'UTC');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.recentActivity).toHaveLength(1);
    expect(result.value.recentActivity[0]).toMatchObject({
      kind: 'commit',
      status: 'fail',
      commitSha: 'd2f363de80e51157947e36f40d2965404e162b21',
      suiteCount: 2,
      projectName: 'Checkout',
      commitMessage: 'fix(ci): retry throttled run reports',
      commitAuthor: 'Aisaac2205',
      casesPassed: 2,
      casesTotal: 3,
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
