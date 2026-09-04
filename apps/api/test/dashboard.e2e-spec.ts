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
import { DashboardModule } from '../src/modules/dashboard/dashboard.module';
import { OrganizationsModule } from '../src/modules/organizations/organizations.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { stubQueues } from './support/stub-queues';
import { testEnv } from './support/test-env';

const session: SessionContext = {
  user: {
    id: 'user-1',
    email: 'ada@acme.test',
    name: 'Ada Lovelace',
    emailVerified: true,
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

describe('Dashboard (e2e)', () => {
  let app: INestApplication<App>;
  const read = jest.fn();
  const prisma = {
    orgMember: { findFirst: jest.fn() },
    project: { findFirst: jest.fn(), count: jest.fn() },
    suite: { count: jest.fn() },
    run: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
    $queryRaw: jest.fn(),
    runCase: { groupBy: jest.fn() },
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
    prisma.project.count.mockResolvedValue(2);
    prisma.suite.count.mockResolvedValue(3);
    prisma.run.count.mockResolvedValue(4);
    prisma.run.findMany.mockResolvedValue([runRow]);
    prisma.run.groupBy.mockResolvedValue([{ commitSha: runRow.commitSha }]);
    prisma.$queryRaw.mockResolvedValue([{ day: '2026-06-16', count: 3 }]);
    prisma.runCase.groupBy.mockResolvedValue([
      { runId: 'run-1', status: 'pass', _count: { _all: 1 } },
    ]);

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

  it('returns a traceability calendar for the requested year', async () => {
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
    expect(body.timeZone).toBe('America/Guatemala');
    expect(body.days).toEqual([
      { date: '2026-06-16', scm: 3, proposals: 0, official: 3, runs: 3 },
    ]);
    expect(body.totals).toEqual({
      scm: 3,
      proposals: 0,
      official: 3,
      runs: 3,
    });
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
});
