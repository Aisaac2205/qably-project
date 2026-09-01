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
import { OrganizationsModule } from '../src/modules/organizations/organizations.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RunsModule } from '../src/modules/runs/runs.module';

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

describe('Runs queries (e2e)', () => {
  let app: INestApplication<App>;
  const read = jest.fn();
  const prisma = {
    orgMember: { findFirst: jest.fn() },
    run: { findMany: jest.fn(), findFirst: jest.fn() },
    runCase: { findMany: jest.fn(), groupBy: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    read.mockResolvedValue(session);
    prisma.orgMember.findFirst.mockResolvedValue({
      organizationId: 'org-1',
      role: 'member',
      organization: { slug: 'acme' },
    });
    prisma.run.findMany.mockResolvedValue([runRow]);
    prisma.run.findFirst.mockResolvedValue(runRow);
    prisma.runCase.findMany.mockResolvedValue([runCaseRow()]);
    prisma.runCase.groupBy.mockResolvedValue([
      { runId: 'run-1', status: 'pending', _count: { _all: 1 } },
    ]);

    const moduleFixture = await Test.createTestingModule({
      imports: [PrismaModule, AuthModule, OrganizationsModule, RunsModule],
    })
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

  it('refuses the run query routes without a session', async () => {
    read.mockResolvedValue(null);

    await request(app.getHttpServer()).get('/runs').expect(401);
  });

  it('answers 403 when the organization header names a foreign organization', async () => {
    prisma.orgMember.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/runs')
      .set('x-organization-id', 'org-someone-else')
      .expect(403);
  });

  it('answers 404 for a run belonging to another organization', async () => {
    prisma.run.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer()).get('/runs/run-1').expect(404);
  });

  it('lists runs of the caller organization with case counts and no full case list', async () => {
    const response = await request(app.getHttpServer())
      .get('/runs')
      .expect(200);

    const body = response.body as {
      id: string;
      cases?: unknown;
      caseCounts: { total: number };
    }[];
    expect(body).toHaveLength(1);
    expect(body[0].cases).toBeUndefined();
    expect(body[0].caseCounts.total).toBe(1);
  });

  it('filters the list by project when the query names one', async () => {
    await request(app.getHttpServer())
      .get('/runs?projectId=project-1')
      .expect(200);

    expect(prisma.run.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', projectId: 'project-1' },
      }),
    );
  });

  it('returns one run with its cases ordered by position', async () => {
    const response = await request(app.getHttpServer())
      .get('/runs/run-1')
      .expect(200);

    const body = response.body as { id: string; cases: unknown[] };
    expect(body.id).toBe('run-1');
    expect(body.cases).toHaveLength(1);
  });
});
