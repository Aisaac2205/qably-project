import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  CiRunDetailRecord,
  CiRunsPageRecord,
  RunStatus,
} from '@qably/types';
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
import { OrganizationsModule } from '../src/modules/organizations/organizations.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RunsModule } from '../src/modules/runs/runs.module';
import { stubQueues } from './support/stub-queues';
import { testEnv } from './support/test-env';

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

function ciRunRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ci-run-a',
    organizationId: 'org-1',
    projectId: 'project-1',
    source: 'github_actions' as const,
    externalId: '903',
    workflowName: 'CI',
    runNumber: 42,
    runAttempt: 1,
    branch: 'main',
    headRef: null,
    actor: 'ana',
    eventName: 'push',
    serverUrl: 'https://github.com',
    repository: 'acme/shop',
    commitSha: '1f2e3d4c5b6a79880011223344556677889900aa',
    commitMessage: 'fix: keep the cart total in sync',
    commitAuthor: 'Ana Lopez',
    startedAt: new Date('2026-10-03T14:00:00.000Z'),
    lastReportedAt: new Date('2026-10-03T14:12:20.000Z'),
    ...overrides,
  };
}

function jobRunRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    suiteId: 'suite-1',
    name: 'Checkout regression',
    status: 'pass' as RunStatus,
    startedAt: new Date('2026-10-03T14:00:05.000Z'),
    ciJobKey: 'api',
    reportExternalId: 'gha-903-api-junit-unit-xml-ab12cd34',
    suite: { name: 'Checkout' },
    ...overrides,
  };
}

const ciRuns = [
  ciRunRow(),
  ciRunRow({
    id: 'ci-run-b',
    externalId: '902',
    startedAt: new Date('2026-10-03T13:00:00.000Z'),
    branch: null,
    workflowName: null,
  }),
  ciRunRow({
    id: 'ci-run-c',
    externalId: '901',
    startedAt: new Date('2026-10-03T12:00:00.000Z'),
  }),
  ciRunRow({
    id: 'ci-run-foreign',
    organizationId: 'org-2',
    projectId: 'project-2',
  }),
];

const runStatuses: Record<string, RunStatus[]> = {
  'ci-run-a': ['pass', 'fail'],
  'ci-run-b': ['pass'],
};

interface CiRunWhere {
  id?: string;
  organizationId?: string;
  projectId?: string;
}

interface CiRunArgs {
  where: CiRunWhere;
  cursor?: { id: string };
}

function matches(row: (typeof ciRuns)[number], where: CiRunWhere): boolean {
  return (
    (where.id === undefined || row.id === where.id) &&
    (where.organizationId === undefined ||
      row.organizationId === where.organizationId) &&
    (where.projectId === undefined || row.projectId === where.projectId)
  );
}

interface GroupByArgs {
  where: { ciRunId: { in: string[] } };
}

describe('CI runs (e2e)', () => {
  let app: INestApplication<App>;
  const read = jest.fn();
  const prisma = {
    orgMember: { findFirst: jest.fn() },
    ciRun: { findMany: jest.fn(), findFirst: jest.fn() },
    run: { groupBy: jest.fn(), findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    read.mockResolvedValue(session);
    prisma.orgMember.findFirst.mockResolvedValue({
      organizationId: 'org-1',
      role: 'member',
      organization: { slug: 'acme' },
    });
    prisma.ciRun.findMany.mockImplementation(({ where, cursor }: CiRunArgs) => {
      const scoped = ciRuns.filter((row) => matches(row, where));
      const unknownCursor =
        cursor !== undefined && !scoped.some((row) => row.id === cursor.id);
      return Promise.resolve(unknownCursor ? [] : scoped);
    });
    prisma.ciRun.findFirst.mockImplementation(({ where }: CiRunArgs) =>
      Promise.resolve(ciRuns.find((row) => matches(row, where)) ?? null),
    );
    prisma.run.groupBy.mockImplementation(({ where }: GroupByArgs) =>
      Promise.resolve(
        where.ciRunId.in.flatMap((ciRunId) =>
          (runStatuses[ciRunId] ?? []).map((status) => ({ ciRunId, status })),
        ),
      ),
    );
    prisma.run.findMany.mockResolvedValue([]);

    const moduleFixture = await stubQueues(
      Test.createTestingModule({
        imports: [
          ConfigModule,
          PrismaModule,
          AuthModule,
          OrganizationsModule,
          RunsModule,
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

  describe('access', () => {
    it.each(['/ci-runs?projectId=project-1', '/ci-runs/ci-run-a'])(
      'refuses %s without a session',
      async (path) => {
        read.mockResolvedValue(null);

        await request(app.getHttpServer()).get(path).expect(401);
      },
    );

    it.each(['/ci-runs?projectId=project-1', '/ci-runs/ci-run-a'])(
      'answers 403 on %s when the organization header names a foreign organization',
      async (path) => {
        prisma.orgMember.findFirst.mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(path)
          .set('x-organization-id', 'org-someone-else')
          .expect(403);
      },
    );
  });

  describe('GET /ci-runs', () => {
    it.each([
      '/ci-runs',
      '/ci-runs?projectId=project-1&limit=0',
      '/ci-runs?projectId=project-1&limit=101',
    ])('answers 400 for %s', async (path) => {
      await request(app.getHttpServer()).get(path).expect(400);

      expect(prisma.ciRun.findMany).not.toHaveBeenCalled();
    });

    it('returns each CI run with its derived status, without runs or null columns', async () => {
      const response = await request(app.getHttpServer())
        .get('/ci-runs?projectId=project-1')
        .expect(200);

      const body = response.body as CiRunsPageRecord;
      expect(body.items.map((item) => [item.id, item.status])).toEqual([
        ['ci-run-a', 'failing'],
        ['ci-run-b', 'passing'],
        ['ci-run-c', 'passing'],
      ]);
      expect(body.items[0]).toEqual({
        id: 'ci-run-a',
        projectId: 'project-1',
        source: 'github_actions',
        externalId: '903',
        status: 'failing',
        startedAt: '2026-10-03T14:00:00.000Z',
        lastReportedAt: '2026-10-03T14:12:20.000Z',
        workflowName: 'CI',
        runNumber: 42,
        runAttempt: 1,
        branch: 'main',
        actor: 'ana',
        eventName: 'push',
        serverUrl: 'https://github.com',
        repository: 'acme/shop',
        commitSha: '1f2e3d4c5b6a79880011223344556677889900aa',
        commitMessage: 'fix: keep the cart total in sync',
        commitAuthor: 'Ana Lopez',
      });
      expect(body.items[1]).not.toHaveProperty('branch');
      expect(body.items[1]).not.toHaveProperty('workflowName');
      expect(body.items[1]).not.toHaveProperty('runs');
    });

    it('asks for 25 rows plus one when no limit is given', async () => {
      await request(app.getHttpServer())
        .get('/ci-runs?projectId=project-1')
        .expect(200);

      expect(prisma.ciRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 26,
          orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
          where: { organizationId: 'org-1', projectId: 'project-1' },
        }),
      );
    });

    it('answers 200 with no items for a project of another organization', async () => {
      const response = await request(app.getHttpServer())
        .get('/ci-runs?projectId=project-2')
        .expect(200);

      expect(response.body).toEqual({ items: [] });
      expect(prisma.run.groupBy).not.toHaveBeenCalled();
    });

    it('answers 200 with no items for an unknown cursor, never a 500', async () => {
      const response = await request(app.getHttpServer())
        .get('/ci-runs?projectId=project-1&cursor=ci-run-gone')
        .expect(200);

      expect(response.body).toEqual({ items: [] });
    });

    it('resumes after the cursor row through the query contract', async () => {
      await request(app.getHttpServer())
        .get('/ci-runs?projectId=project-1&limit=10&cursor=ci-run-b')
        .expect(200);

      expect(prisma.ciRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 11,
          cursor: { id: 'ci-run-b' },
          skip: 1,
        }),
      );
    });

    it('returns a cursor only when the extra row proves another page exists', async () => {
      const first = await request(app.getHttpServer())
        .get('/ci-runs?projectId=project-1&limit=2')
        .expect(200);
      const last = await request(app.getHttpServer())
        .get('/ci-runs?projectId=project-1&limit=3')
        .expect(200);

      const firstBody = first.body as CiRunsPageRecord;
      expect(firstBody.items).toHaveLength(2);
      expect(firstBody.nextCursor).toBe('ci-run-b');
      const lastBody = last.body as CiRunsPageRecord;
      expect(lastBody.items).toHaveLength(3);
      expect(lastBody).not.toHaveProperty('nextCursor');
    });
  });

  describe('GET /ci-runs/:id', () => {
    it('returns the summary with the flat runs and the status derived from all of them', async () => {
      prisma.run.findMany.mockResolvedValue([
        jobRunRow({ id: 'run-1', name: 'Cart', status: 'pass' }),
        jobRunRow({ id: 'run-2', name: 'Checkout', status: 'fail' }),
        jobRunRow({
          id: 'run-3',
          name: 'Search',
          ciJobKey: null,
          reportExternalId: null,
        }),
      ]);

      const response = await request(app.getHttpServer())
        .get('/ci-runs/ci-run-a')
        .expect(200);

      const body = response.body as CiRunDetailRecord;
      expect(body.id).toBe('ci-run-a');
      expect(body.status).toBe('failing');
      expect(body.runs.map((run) => run.id)).toEqual([
        'run-1',
        'run-2',
        'run-3',
      ]);
      expect(body.runs[1]).toMatchObject({
        suiteName: 'Checkout',
        status: 'fail',
        ciJobKey: 'api',
        reportExternalId: 'gha-903-api-junit-unit-xml-ab12cd34',
      });
      expect(body.runs[2]).not.toHaveProperty('ciJobKey');
      expect(body.runs[2]).not.toHaveProperty('reportExternalId');
      expect(prisma.run.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', ciRunId: 'ci-run-a' },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        }),
      );
      const [[args]] = prisma.run.findMany.mock.calls as [
        [Record<string, unknown>],
      ];
      expect(args).not.toHaveProperty('take');
    });

    it('returns an empty runs list and a passing status when nothing is linked', async () => {
      const response = await request(app.getHttpServer())
        .get('/ci-runs/ci-run-c')
        .expect(200);

      const body = response.body as CiRunDetailRecord;
      expect(body.runs).toEqual([]);
      expect(body.status).toBe('passing');
    });

    it('answers the same 404 for a CI run of another organization and for an unknown id', async () => {
      const foreign = await request(app.getHttpServer())
        .get('/ci-runs/ci-run-foreign')
        .expect(404);
      const unknown = await request(app.getHttpServer())
        .get('/ci-runs/ci-run-gone')
        .expect(404);

      const notFound = {
        statusCode: 404,
        code: 'not-found',
        message: 'CI run not found',
      };
      expect(foreign.body).toMatchObject(notFound);
      expect(unknown.body).toMatchObject(notFound);
      expect(prisma.run.findMany).not.toHaveBeenCalled();
    });
  });
});
