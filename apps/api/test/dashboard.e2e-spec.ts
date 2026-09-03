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
  commitSha: null,
  commitMessage: null,
  commitAuthor: null,
};

describe('Dashboard (e2e)', () => {
  let app: INestApplication<App>;
  const read = jest.fn();
  const prisma = {
    orgMember: { findFirst: jest.fn() },
    project: { findFirst: jest.fn(), count: jest.fn() },
    suite: { count: jest.fn() },
    run: { count: jest.fn(), findMany: jest.fn() },
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
    prisma.runCase.groupBy.mockResolvedValue([
      { runId: 'run-1', status: 'pass', _count: { _all: 1 } },
    ]);

    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule,
        PrismaModule,
        AuthModule,
        OrganizationsModule,
        DashboardModule,
      ],
    })
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
      recentCiRuns: unknown[];
    };

    expect(body.totalProjects).toBe(2);
    expect(body.totalSuites).toBe(3);
    expect(body.totalRuns).toBe(4);
    expect(body.windowDays).toBe(7);
    expect(body.passRate).toBeCloseTo(1);
    expect(body.recentRuns).toHaveLength(1);
    expect(body.recentCiRuns).toHaveLength(1);
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
});
