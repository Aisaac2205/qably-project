import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  SESSION_READER,
  type SessionContext,
} from '../src/modules/auth/auth.contracts';
import { AUTH_INSTANCE } from '../src/modules/auth/auth.instance';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ConfigModule } from '../src/config/config.module';
import { ENV } from '../src/config/config.tokens';
import { Prisma } from '../generated/prisma/client';
import { DashboardModule } from '../src/modules/dashboard/dashboard.module';
import { OrganizationsModule } from '../src/modules/organizations/organizations.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { stubQueues } from './support/stub-queues';
import { testEnv } from './support/test-env';
import { emulateRunsStageCountsFromCapturedSql } from './support/time-zone-bucketing-oracle';

const session: SessionContext = {
  user: {
    id: 'user-1',
    email: 'ada@acme.test',
    name: 'Ada Lovelace',
    emailVerified: true,
    locale: null,
  },
  sessionId: 'session-1',
  expiresAt: new Date('2030-01-01T00:00:00.000Z'),
};

const runRow = {
  id: 'run-1',
  projectId: 'project-1',
  organizationId: 'org-1',
  suiteId: 'suite-1',
  name: 'Checkout regression',
  status: 'pass' as const,
  source: 'github_actions' as const,
  externalId: 'ci-1',
  startedAt: new Date('2026-06-16T10:00:00.000Z'),
  finishedAt: null,
  executedById: null,
  commitSha: 'd2f363de80e51157947e36f40d2965404e162b21',
  commitMessage: 'fix(ci): retry throttled run reports',
  commitAuthor: 'Aisaac2205',
};

const runListRow = {
  ...runRow,
  suite: { name: 'Checkout' },
  project: { name: 'Checkout Web' },
};

interface RawQueryRawSql {
  strings: readonly string[];
}

interface QueryRawFixtures {
  caseCounts?: unknown[];
  runCounts?: unknown[];
  casesPassing?: unknown[];
  deliveryCounts?: unknown[];
  inAppCounts?: unknown[];
  traceability?: unknown[];
}

function queryRawRouter(fixtures: QueryRawFixtures = {}) {
  return (sql: RawQueryRawSql) => {
    const text = sql.strings.join('');

    if (text.includes('FROM "run_case" rc')) {
      return Promise.resolve(fixtures.caseCounts ?? []);
    }
    if (text.includes('FROM "run" r') && text.includes('"failedRuns"')) {
      return Promise.resolve(fixtures.runCounts ?? []);
    }
    if (text.includes('WITH latest AS')) {
      return Promise.resolve(fixtures.casesPassing ?? []);
    }
    if (text.includes('FROM "notification_delivery" d')) {
      return Promise.resolve(fixtures.deliveryCounts ?? []);
    }
    if (text.includes('FROM "notification" n')) {
      return Promise.resolve(fixtures.inAppCounts ?? []);
    }

    return Promise.resolve(
      fixtures.traceability ?? [{ day: '2026-06-16', count: 3 }],
    );
  };
}

describe('Dashboard (e2e)', () => {
  let app: INestApplication<App>;
  const read = jest.fn();
  const prisma = {
    orgMember: { findFirst: jest.fn() },
    project: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    suite: { count: jest.fn(), groupBy: jest.fn() },
    testCase: { groupBy: jest.fn() },
    run: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
    $queryRaw: jest.fn(),
    runCase: { groupBy: jest.fn() },
    notificationWebhook: { findMany: jest.fn() },
    notificationPreference: { findMany: jest.fn() },
    notificationDelivery: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    read.mockResolvedValue(session);
    prisma.orgMember.findFirst.mockResolvedValue({
      organizationId: 'org-1',
      role: 'member',
      organization: { slug: 'acme' },
    });
    prisma.project.findFirst.mockResolvedValue({ id: 'project-1' });
    prisma.project.findMany.mockResolvedValue([
      { id: 'project-1', name: 'Checkout Web' },
    ]);
    prisma.project.count.mockResolvedValue(2);
    prisma.suite.count.mockResolvedValue(3);
    prisma.suite.groupBy.mockResolvedValue([
      { projectId: 'project-1', _count: { _all: 3 } },
    ]);
    prisma.testCase.groupBy.mockResolvedValue([
      { projectId: 'project-1', _count: { _all: 10 } },
    ]);
    prisma.run.count.mockResolvedValue(4);
    prisma.run.findMany.mockResolvedValue([runListRow]);
    prisma.run.groupBy.mockImplementation(
      (args: { by: string[] }): Promise<unknown[]> => {
        if (args.by.includes('commitSha')) {
          return Promise.resolve([{ commitSha: runRow.commitSha }]);
        }
        if (args.by.includes('projectId')) {
          return Promise.resolve([
            { projectId: 'project-1', _max: { startedAt: runRow.startedAt } },
          ]);
        }
        return Promise.resolve([]);
      },
    );
    prisma.$queryRaw.mockImplementation(queryRawRouter());
    prisma.runCase.groupBy.mockResolvedValue([
      { runId: 'run-1', status: 'pass', _count: { _all: 1 } },
    ]);
    prisma.notificationWebhook.findMany.mockResolvedValue([]);
    prisma.notificationPreference.findMany.mockResolvedValue([]);
    prisma.notificationDelivery.findFirst.mockResolvedValue(null);

    const moduleFixture = await stubQueues(
      Test.createTestingModule({
        imports: [
          ConfigModule,
          PrismaModule,
          AuthModule,
          OrganizationsModule,
          DashboardModule,
        ],
      }),
    )
      .overrideProvider(ENV)
      .useValue(testEnv)
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(AUTH_INSTANCE)
      .useValue({ handler: () => new Response('{}', { status: 200 }) })
      .overrideProvider(SESSION_READER)
      .useValue({ read })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter(false));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('refuses the dashboard summary route without a session', async () => {
    read.mockResolvedValue(null);

    await request(app.getHttpServer()).get('/dashboard/summary').expect(401);
  });

  it('answers 403 when the organization header names a foreign organization', async () => {
    prisma.orgMember.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set('x-organization-id', 'org-someone-else')
      .expect(403);
  });

  it('answers 404 when the requested project is outside the organization', async () => {
    prisma.project.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/dashboard/summary?projectId=project-x')
      .expect(404);
  });

  it('returns a summary with counts, pass rate, window and recent runs', async () => {
    const response = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .expect(200);

    const body = response.body as {
      totalProjects: number;
      totalSuites: number;
      totalRuns: number;
      windowDays: number;
      passRate: number;
      recentRuns: unknown[];
      recentCiCommits: { shortSha: string; runCount: number }[];
    };

    expect(body.totalProjects).toBe(2);
    expect(body.totalSuites).toBe(3);
    expect(body.totalRuns).toBe(4);
    expect(body.windowDays).toBe(7);
    expect(body.passRate).toBeCloseTo(1);
    expect(body.recentRuns).toHaveLength(1);
    expect(body.recentCiCommits).toHaveLength(1);
    expect(body.recentCiCommits[0]).toMatchObject({
      shortSha: 'd2f363d',
      runCount: 1,
    });
  });

  it('reports a null passRate when every case in the window is pending or skipped', async () => {
    prisma.runCase.groupBy.mockResolvedValueOnce([
      { status: 'pending', _count: { _all: 2 } },
      { status: 'skip', _count: { _all: 1 } },
    ]);

    const response = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .expect(200);

    const body = response.body as { passRate: number | null };
    expect(body.passRate).toBeNull();
  });

  it('counts blocked cases in the pass-rate denominator', async () => {
    prisma.runCase.groupBy.mockResolvedValueOnce([
      { status: 'pass', _count: { _all: 3 } },
      { status: 'blocked', _count: { _all: 1 } },
    ]);

    const response = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .expect(200);

    const body = response.body as { passRate: number };
    expect(body.passRate).toBeCloseTo(0.75);
  });

  it('excludes pending and skipped cases from the pass-rate denominator', async () => {
    prisma.runCase.groupBy.mockResolvedValueOnce([
      { status: 'pass', _count: { _all: 1 } },
      { status: 'fail', _count: { _all: 1 } },
      { status: 'pending', _count: { _all: 5 } },
      { status: 'skip', _count: { _all: 5 } },
    ]);

    const response = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .expect(200);

    const body = response.body as { passRate: number };
    expect(body.passRate).toBeCloseTo(0.5);
  });

  it('scopes the summary to a single project when projectId is given', async () => {
    await request(app.getHttpServer())
      .get('/dashboard/summary?projectId=project-1')
      .expect(200);

    expect(prisma.suite.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', projectId: 'project-1' },
    });
  });

  it('rejects an empty projectId query parameter', async () => {
    await request(app.getHttpServer())
      .get('/dashboard/summary?projectId=')
      .expect(400);
  });

  it('returns a traceability calendar for the requested year, falling back to UTC when tz is absent', async () => {
    const response = await request(app.getHttpServer())
      .get('/dashboard/traceability?year=2026')
      .expect(200);

    const body = response.body as {
      year: number;
      timeZone: string;
      totals: Record<string, number>;
      days: { date: string; runs: number }[];
    };

    expect(body.year).toBe(2026);
    expect(body.timeZone).toBe('UTC');
    expect(body.days).toEqual([
      { date: '2026-06-16', scm: 3, proposals: 3, official: 3, runs: 3 },
    ]);
    expect(body.totals).toEqual({
      scm: 3,
      proposals: 3,
      official: 3,
      runs: 3,
    });
  });

  it('rejects a malformed tz on the traceability route', async () => {
    await request(app.getHttpServer())
      .get('/dashboard/traceability?year=2026&tz=Not/AZone')
      .expect(400);
  });

  it('honors a valid tz on the traceability route', async () => {
    const response = await request(app.getHttpServer())
      .get('/dashboard/traceability?year=2026&tz=America/Guatemala')
      .expect(200);

    const body = response.body as { timeZone: string };
    expect(body.timeZone).toBe('America/Guatemala');
  });

  it('rejects a traceability request without a year', async () => {
    await request(app.getHttpServer())
      .get('/dashboard/traceability')
      .expect(400);
  });

  it('rejects a traceability year outside the supported range', async () => {
    await request(app.getHttpServer())
      .get('/dashboard/traceability?year=1999')
      .expect(400);
  });

  it('answers 404 when the traceability project is outside the organization', async () => {
    prisma.project.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/dashboard/traceability?year=2026&projectId=project-x')
      .expect(404);
  });

  it('refuses the traceability route without a session', async () => {
    read.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/dashboard/traceability?year=2026')
      .expect(401);
  });

  it('buckets a run started at 20:00Z and one started at 02:00Z onto the same correct local day for a negative-offset zone (AT TIME ZONE direction regression)', async () => {
    const seededRuns = [
      { startedAt: new Date('2026-06-16T20:00:00.000Z') },
      { startedAt: new Date('2026-06-17T02:00:00.000Z') },
    ];

    prisma.$queryRaw.mockImplementation((sql: { strings: readonly string[] }) =>
      Promise.resolve(
        emulateRunsStageCountsFromCapturedSql(
          sql,
          'America/Guatemala',
          2026,
          seededRuns,
        ),
      ),
    );

    const response = await request(app.getHttpServer())
      .get('/dashboard/traceability?year=2026&tz=America/Guatemala')
      .expect(200);

    const body = response.body as {
      days: {
        date: string;
        scm: number;
        proposals: number;
        official: number;
        runs: number;
      }[];
    };

    expect(body.days).toEqual([
      { date: '2026-06-16', scm: 0, proposals: 0, official: 0, runs: 2 },
    ]);
  });

  it('answers 400 instead of 500 when Postgres rejects a zone Node accepts as valid', async () => {
    prisma.$queryRaw.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Raw query failed. Code: `22023`. Message: `invalid input syntax for type timestamp with time zone: "America/Guatemala"`',
        {
          code: 'P2010',
          clientVersion: '7.0.0',
          meta: {
            code: '22023',
            message:
              'invalid input syntax for type timestamp with time zone: "America/Guatemala"',
          },
        },
      ),
    );

    const response = await request(app.getHttpServer())
      .get('/dashboard/traceability?year=2026&tz=America/Guatemala')
      .expect(400);

    const body = response.body as { message: string; issues: unknown[] };
    expect(body.message).toBe('Validation failed');
    expect(body.issues).toEqual([
      { path: 'tz', message: 'Invalid IANA time zone' },
    ]);
  });

  describe('GET /dashboard/overview', () => {
    const NOW = new Date('2026-06-16T11:00:00.000Z');

    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['nextTick'] });
      jest.setSystemTime(NOW);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('rejects a period outside 7/30/90', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/overview?period=15')
        .expect(400);
    });

    it('rejects a missing period', async () => {
      await request(app.getHttpServer()).get('/dashboard/overview').expect(400);
    });

    it('rejects a malformed tz', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/overview?period=7&tz=Not/AZone')
        .expect(400);
    });

    it('falls back to UTC when tz is absent', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/overview?period=7')
        .expect(200);

      const body = response.body as { timeZone: string };
      expect(body.timeZone).toBe('UTC');
    });

    it('refuses the route without a session', async () => {
      read.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/dashboard/overview?period=7')
        .expect(401);
    });

    it('answers 403 when the organization header names a foreign organization', async () => {
      prisma.orgMember.findFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/dashboard/overview?period=7')
        .set('x-organization-id', 'org-someone-else')
        .expect(403);
    });

    it('answers 404 when projectId targets a project outside the organization', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/dashboard/overview?period=7&projectId=project-x')
        .expect(404);
    });

    it('returns recent runs with project name, source and commit fields, capped at 4', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/overview?period=7')
        .expect(200);

      const body = response.body as {
        recentRuns: {
          projectName: string;
          source: string;
          commitSha?: string;
          commitMessage?: string;
          commitAuthor?: string;
          casesPassed: number;
          casesTotal: number;
        }[];
      };

      expect(body.recentRuns.length).toBeLessThanOrEqual(4);
      expect(body.recentRuns[0]).toMatchObject({
        projectName: 'Checkout Web',
        source: 'github_actions',
        commitSha: runRow.commitSha,
        commitMessage: runRow.commitMessage,
        commitAuthor: runRow.commitAuthor,
        casesPassed: 1,
        casesTotal: 1,
      });
    });

    it('reports null/zero KPIs and empty lists for an organization with no data, without crashing', async () => {
      prisma.project.findMany.mockResolvedValue([]);
      prisma.suite.groupBy.mockResolvedValue([]);
      prisma.testCase.groupBy.mockResolvedValue([]);
      prisma.run.findMany.mockResolvedValue([]);
      prisma.run.groupBy.mockResolvedValue([]);
      prisma.$queryRaw.mockImplementation(queryRawRouter());

      const response = await request(app.getHttpServer())
        .get('/dashboard/overview?period=7')
        .expect(200);

      const body = response.body as {
        kpis: {
          passRate: { value: number | null };
          runs: { value: number };
          failedCases: { value: number };
          avgRunDurationMs: { value: number | null };
        };
        projects: unknown[];
        recentRuns: unknown[];
        casesPassing: { total: number };
      };

      expect(body.kpis.passRate.value).toBeNull();
      expect(body.kpis.runs.value).toBe(0);
      expect(body.kpis.failedCases.value).toBe(0);
      expect(body.kpis.avgRunDurationMs.value).toBeNull();
      expect(body.projects).toEqual([]);
      expect(body.recentRuns).toEqual([]);
      expect(body.casesPassing.total).toBe(0);
    });

    it('computes exactly 7 ascending calendar-day buckets across a DST transition', async () => {
      jest.setSystemTime(new Date('2026-03-10T12:00:00.000Z'));

      const response = await request(app.getHttpServer())
        .get('/dashboard/overview?period=7&tz=America/New_York')
        .expect(200);

      const body = response.body as {
        passRateSeries: { current: { date: string }[] };
      };

      expect(body.passRateSeries.current.map((point) => point.date)).toEqual([
        '2026-03-04',
        '2026-03-05',
        '2026-03-06',
        '2026-03-07',
        '2026-03-08',
        '2026-03-09',
        '2026-03-10',
      ]);
    });

    it('reports executed/passed/failed/blocked per day, derived from the same run_case status aggregation as passRate', async () => {
      prisma.$queryRaw.mockImplementation(
        queryRawRouter({
          caseCounts: [
            {
              projectId: 'project-1',
              window: 'current',
              day: '2026-06-16',
              status: 'pass',
              count: 6,
            },
            {
              projectId: 'project-1',
              window: 'current',
              day: '2026-06-16',
              status: 'fail',
              count: 2,
            },
            {
              projectId: 'project-1',
              window: 'current',
              day: '2026-06-16',
              status: 'blocked',
              count: 1,
            },
          ],
        }),
      );

      const response = await request(app.getHttpServer())
        .get('/dashboard/overview?period=7')
        .expect(200);

      const body = response.body as {
        passRateSeries: {
          current: {
            date: string;
            executed: number;
            passed: number;
            failed: number;
            blocked: number;
          }[];
        };
      };

      const day = body.passRateSeries.current.find(
        (point) => point.date === '2026-06-16',
      );

      expect(day).toMatchObject({
        executed: 9,
        passed: 6,
        failed: 2,
        blocked: 1,
      });
    });

    it('scopes results to a single project when projectId is given', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/overview?period=7&projectId=project-1')
        .expect(200);

      expect(prisma.suite.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', projectId: 'project-1' },
        }),
      );
    });
  });

  describe('GET /dashboard/channels', () => {
    const enabledWebhook = {
      id: 'webhook-1',
      type: 'slack' as const,
      name: 'Team Slack',
      eventTypes: ['run_failed'],
    };
    const NOW = new Date('2026-06-16T11:00:00.000Z');

    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['nextTick'] });
      jest.setSystemTime(NOW);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('refuses the route without a session', async () => {
      read.mockResolvedValue(null);

      await request(app.getHttpServer()).get('/dashboard/channels').expect(401);
    });

    it('answers 403 when the organization header names a foreign organization', async () => {
      prisma.orgMember.findFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/dashboard/channels')
        .set('x-organization-id', 'org-someone-else')
        .expect(403);
    });

    it('rejects a malformed tz', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/channels?tz=Not/AZone')
        .expect(400);
    });

    it('falls back to UTC when tz is absent and reports an empty organization without crashing', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/channels')
        .expect(200);

      const body = response.body as {
        webhooks: unknown[];
        email: { enabled: boolean; eventTypes: string[] };
        lastDelivery: {
          webhookId: string;
          eventType: string;
          status: string;
          deliveredAt: string;
        } | null;
      };

      expect(body.webhooks).toEqual([]);
      expect(body.lastDelivery).toBeNull();
    });

    it('excludes a disabled webhook, returning only the enabled one', async () => {
      prisma.notificationWebhook.findMany.mockResolvedValue([enabledWebhook]);

      const response = await request(app.getHttpServer())
        .get('/dashboard/channels')
        .expect(200);

      const body = response.body as {
        webhooks: { id: string; name: string }[];
      };

      expect(prisma.notificationWebhook.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', enabled: true },
        }),
      );
      expect(body.webhooks).toHaveLength(1);
      expect(body.webhooks[0]).toMatchObject({
        id: 'webhook-1',
        name: 'Team Slack',
      });
    });

    it('zero-fills a webhook with no deliveries in the window', async () => {
      prisma.notificationWebhook.findMany.mockResolvedValue([enabledWebhook]);
      prisma.$queryRaw.mockImplementation(
        queryRawRouter({ deliveryCounts: [] }),
      );

      const response = await request(app.getHttpServer())
        .get('/dashboard/channels')
        .expect(200);

      const body = response.body as {
        webhooks: { sent: number; failed: number; daily: unknown[] }[];
      };

      expect(body.webhooks[0].sent).toBe(0);
      expect(body.webhooks[0].failed).toBe(0);
      expect(body.webhooks[0].daily).toHaveLength(14);
    });

    it('reports a failed-only day without inflating the sent total', async () => {
      prisma.notificationWebhook.findMany.mockResolvedValue([enabledWebhook]);
      prisma.$queryRaw.mockImplementation(
        queryRawRouter({
          deliveryCounts: [
            {
              webhookId: 'webhook-1',
              day: '2026-06-16',
              status: 'failed',
              count: 2,
            },
          ],
        }),
      );

      const response = await request(app.getHttpServer())
        .get('/dashboard/channels')
        .expect(200);

      const body = response.body as {
        webhooks: {
          sent: number;
          failed: number;
          daily: { date: string; sent: number; failed: number }[];
        }[];
      };

      expect(body.webhooks[0].sent).toBe(0);
      expect(body.webhooks[0].failed).toBe(2);
      expect(
        body.webhooks[0].daily.find((point) => point.date === '2026-06-16'),
      ).toEqual({ date: '2026-06-16', sent: 0, failed: 2 });
    });

    it('applies the default email preferences for a user with no stored rows', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/channels')
        .expect(200);

      const body = response.body as {
        email: { enabled: boolean; eventTypes: string[] };
      };

      expect(prisma.notificationPreference.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: 'org-1',
            userId: 'user-1',
            channel: 'email',
          },
        }),
      );
      expect(body.email.enabled).toBe(true);
      expect(body.email.eventTypes).toContain('case_regressed');
    });

    it('excludes a newer delivery belonging to another organization from lastDelivery', async () => {
      prisma.notificationWebhook.findMany.mockResolvedValue([enabledWebhook]);
      const deliveries = [
        {
          organizationId: 'org-1',
          webhookId: 'webhook-1',
          eventType: 'run_failed',
          status: 'sent',
          deliveredAt: new Date('2026-06-15T10:00:00.000Z'),
        },
        {
          organizationId: 'org-foreign',
          webhookId: 'webhook-1',
          eventType: 'run_failed',
          status: 'sent',
          deliveredAt: new Date('2026-06-16T10:00:00.000Z'),
        },
      ];
      prisma.notificationDelivery.findFirst.mockImplementation(
        (args: {
          where: { organizationId: string; webhookId: { in: string[] } };
        }) => {
          const matches = deliveries
            .filter(
              (row) =>
                row.organizationId === args.where.organizationId &&
                args.where.webhookId.in.includes(row.webhookId),
            )
            .sort((a, b) => b.deliveredAt.getTime() - a.deliveredAt.getTime());

          return Promise.resolve(matches[0] ?? null);
        },
      );

      const response = await request(app.getHttpServer())
        .get('/dashboard/channels')
        .expect(200);

      const body = response.body as {
        lastDelivery: { webhookId: string; deliveredAt: string } | null;
      };

      expect(body.lastDelivery).toEqual({
        webhookId: 'webhook-1',
        eventType: 'run_failed',
        status: 'sent',
        deliveredAt: '2026-06-15T10:00:00.000Z',
      });
    });

    interface FakeInAppNotification {
      organizationId: string;
      userId: string;
      day: string;
      sent: number;
      unread: number;
    }

    function inAppQueryRouter(rows: readonly FakeInAppNotification[]) {
      return (sql: RawQueryRawSql & { values: readonly unknown[] }) => {
        const text = sql.strings.join('');
        if (!text.includes('FROM "notification" n')) {
          return queryRawRouter()(sql);
        }

        const [, organizationId, userId] = sql.values as [
          string,
          string,
          string,
        ];
        const matches = rows.filter(
          (row) =>
            row.organizationId === organizationId && row.userId === userId,
        );

        return Promise.resolve(
          matches.map(({ day, sent, unread }) => ({ day, sent, unread })),
        );
      };
    }

    it("excludes another organization's in-app notifications from the response, even for the same user", async () => {
      prisma.$queryRaw.mockImplementation(
        inAppQueryRouter([
          {
            organizationId: 'org-1',
            userId: 'user-1',
            day: '2026-06-16',
            sent: 3,
            unread: 2,
          },
          {
            organizationId: 'org-foreign',
            userId: 'user-1',
            day: '2026-06-16',
            sent: 99,
            unread: 99,
          },
        ]),
      );

      const response = await request(app.getHttpServer())
        .get('/dashboard/channels')
        .expect(200);

      const body = response.body as {
        inApp: { sent: number; unread: number };
      };
      expect(body.inApp.sent).toBe(3);
      expect(body.inApp.unread).toBe(2);
    });

    it("excludes another user's in-app notifications from the response, even within the same organization", async () => {
      prisma.$queryRaw.mockImplementation(
        inAppQueryRouter([
          {
            organizationId: 'org-1',
            userId: 'user-1',
            day: '2026-06-16',
            sent: 3,
            unread: 2,
          },
          {
            organizationId: 'org-1',
            userId: 'user-2',
            day: '2026-06-16',
            sent: 50,
            unread: 50,
          },
        ]),
      );

      const response = await request(app.getHttpServer())
        .get('/dashboard/channels')
        .expect(200);

      const body = response.body as {
        inApp: { sent: number; unread: number };
      };
      expect(body.inApp.sent).toBe(3);
      expect(body.inApp.unread).toBe(2);
    });

    it('returns zeroed in-app totals and a fully zero-filled daily window for a user with no notifications', async () => {
      prisma.$queryRaw.mockImplementation(inAppQueryRouter([]));

      const response = await request(app.getHttpServer())
        .get('/dashboard/channels')
        .expect(200);

      const body = response.body as {
        inApp: {
          sent: number;
          unread: number;
          daily: { sent: number; failed: number }[];
        };
      };
      expect(body.inApp.sent).toBe(0);
      expect(body.inApp.unread).toBe(0);
      expect(body.inApp.daily).toHaveLength(14);
      expect(
        body.inApp.daily.every(
          (point) => point.sent === 0 && point.failed === 0,
        ),
      ).toBe(true);
    });
  });
});
