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
import { OrganizationsModule } from '../src/modules/organizations/organizations.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SuitesModule } from '../src/modules/suites/suites.module';
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

const suiteRow = {
  id: 'suite-1',
  projectId: 'project-1',
  organizationId: 'org-1',
  name: 'Checkout',
  description: '',
  tags: [],
  isDefault: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  cases: [
    {
      id: 'case-1',
      suiteId: 'suite-1',
      name: 'Adds to cart',
      steps: ['open', 'add'],
      expectedResult: 'cart has one item',
      priority: 'medium',
      state: 'active',
    },
  ],
};

describe('Suites (e2e)', () => {
  let app: INestApplication<App>;
  const read = jest.fn();
  const prisma = {
    orgMember: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    organization: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findUnique: jest.fn(),
    },
    project: { findFirst: jest.fn() },
    suite: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    testCase: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    extractedProposal: { findMany: jest.fn() },
    runCase: { findMany: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    read.mockResolvedValue(session);
    prisma.$transaction.mockImplementation(
      (run: (tx: typeof prisma) => unknown) => run(prisma),
    );
    prisma.orgMember.findFirst.mockResolvedValue({
      organizationId: 'org-1',
      role: 'owner',
      organization: { slug: 'acme' },
      user: { locale: 'en' },
    });
    prisma.project.findFirst.mockResolvedValue({ id: 'project-1' });
    prisma.suite.findFirst.mockResolvedValue(suiteRow);
    prisma.suite.findUniqueOrThrow.mockResolvedValue(suiteRow);
    prisma.suite.create.mockResolvedValue(suiteRow);
    prisma.suite.update.mockResolvedValue(suiteRow);
    prisma.extractedProposal.findMany.mockResolvedValue([]);
    prisma.testCase.findMany.mockResolvedValue([]);
    prisma.runCase.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.organization.findUnique.mockResolvedValue({
      aiEnabled: true,
      aiCredits: 10,
    });

    const moduleFixture = await stubQueues(
      Test.createTestingModule({
        imports: [
          ConfigModule,
          PrismaModule,
          AuthModule,
          OrganizationsModule,
          SuitesModule,
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

  it('refuses the suite routes without a session', async () => {
    read.mockResolvedValue(null);

    await request(app.getHttpServer()).get('/suites').expect(401);
  });

  it('returns the suites of the caller organization with their cases', async () => {
    prisma.suite.findMany.mockResolvedValue([suiteRow]);

    const response = await request(app.getHttpServer())
      .get('/suites')
      .expect(200);

    const body = response.body as { id: string; cases: unknown[] }[];
    expect(body).toHaveLength(1);
    expect(body[0].cases).toHaveLength(1);
  });

  it('exposes health signals per case and a suite-level rollup', async () => {
    prisma.suite.findMany.mockResolvedValue([
      {
        ...suiteRow,
        cases: [
          {
            id: 'case-2',
            suiteId: 'suite-1',
            name: 'checkout_flow',
            steps: [],
            expectedResult: '',
            priority: 'medium',
            state: 'active',
            currentVersion: null,
            executionMode: 'automated',
            automationKey: 'checkout_flow',
            automationClassName: null,
            automationFilePath: null,
          },
        ],
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/suites')
      .expect(200);

    const body = response.body as {
      healthSummary: Record<string, number>;
      cases: { healthSignals: string[] }[];
    }[];
    expect(body[0].cases[0].healthSignals).toEqual(
      expect.arrayContaining(['no-steps', 'raw-name', 'never-run']),
    );
    expect(body[0].healthSummary).toEqual({
      'no-steps': 1,
      'raw-name': 1,
      'never-run': 1,
    });
  });

  it('filters by project when the query names one', async () => {
    prisma.suite.findMany.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/suites?projectId=project-1')
      .expect(200);

    expect(prisma.suite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', projectId: 'project-1' },
      }),
    );
  });

  it('creates a suite and returns 201', async () => {
    const response = await request(app.getHttpServer())
      .post('/suites')
      .send({ projectId: 'project-1', name: '  Checkout  ' })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({ id: 'suite-1', name: 'Checkout' }),
    );
  });

  it('answers 404 when the project belongs to another organization', async () => {
    prisma.project.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post('/suites')
      .send({ projectId: 'project-x', name: 'Checkout' })
      .expect(404);
  });

  it('rejects a body with no project', async () => {
    const response = await request(app.getHttpServer())
      .post('/suites')
      .send({ name: 'Checkout' })
      .expect(400);

    const body = response.body as { issues: { path: string }[] };
    expect(body.issues.map((issue) => issue.path)).toContain('projectId');
  });

  it('answers 409 when the suite name is already used in the project', async () => {
    prisma.suite.create.mockRejectedValue({ code: 'P2002' });

    await request(app.getHttpServer())
      .post('/suites')
      .send({ projectId: 'project-1', name: 'Checkout' })
      .expect(409);
  });

  it('promotes a suite to default and demotes its siblings', async () => {
    await request(app.getHttpServer())
      .patch('/suites/suite-1')
      .send({ isDefault: true })
      .expect(200);

    expect(prisma.suite.updateMany).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        isDefault: true,
        id: { not: 'suite-1' },
      },
      data: { isDefault: false },
    });
  });

  it('adds a case and returns the whole suite', async () => {
    const response = await request(app.getHttpServer())
      .post('/suites/suite-1/cases')
      .send({ name: 'Removes from cart' })
      .expect(201);

    expect(response.body).toEqual(expect.objectContaining({ id: 'suite-1' }));
    expect(prisma.testCase.create).toHaveBeenCalled();
  });

  it('answers 404 for a case that is not in the suite', async () => {
    await request(app.getHttpServer())
      .patch('/suites/suite-1/cases/case-elsewhere')
      .send({ name: 'Renamed' })
      .expect(404);
  });

  it('promotes a draft case to active through the existing case patch', async () => {
    const response = await request(app.getHttpServer())
      .patch('/suites/suite-1/cases/case-1')
      .send({ state: 'active' })
      .expect(200);

    expect(prisma.testCase.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: { state: 'active' },
    });
    expect(response.body).toEqual(expect.objectContaining({ id: 'suite-1' }));
  });

  it('answers 403 when a member tries to delete a suite', async () => {
    prisma.orgMember.findFirst.mockResolvedValue({
      organizationId: 'org-1',
      role: 'member',
      organization: { slug: 'acme' },
    });

    await request(app.getHttpServer()).delete('/suites/suite-1').expect(403);
  });

  it('deletes with 204 when the caller owns the organization', async () => {
    await request(app.getHttpServer()).delete('/suites/suite-1').expect(204);

    expect(prisma.suite.delete).toHaveBeenCalledWith({
      where: { id: 'suite-1' },
    });
  });

  it('answers 403 when the organization header names a foreign organization', async () => {
    prisma.orgMember.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/suites')
      .set('x-organization-id', 'org-someone-else')
      .expect(403);
  });

  it('enqueues file-level documentation for a suite and returns the counts', async () => {
    prisma.testCase.findMany.mockResolvedValue([
      {
        id: 'case-2',
        projectId: 'project-1',
        automationKey: 'Cart > adds an item',
        automationFilePath: 'src/cart.spec.ts',
        steps: [],
        currentVersion: null,
      },
    ]);

    const response = await request(app.getHttpServer())
      .post('/suites/suite-1/document')
      .expect(201);

    expect(response.body).toEqual({
      filesEnqueued: 1,
      casesTargeted: 1,
      casesSkipped: [],
    });
  });

  it('answers 403 for /document when the organization is not entitled to AI', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      aiEnabled: false,
      aiCredits: 0,
    });

    await request(app.getHttpServer())
      .post('/suites/suite-1/document')
      .expect(403);
  });

  it('answers 404 for /document when the suite does not exist', async () => {
    prisma.suite.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post('/suites/suite-1/document')
      .expect(404);
  });

  it('confirms documented draft cases and reports what was skipped', async () => {
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-documented', currentVersionId: 'version-1' },
      { id: 'case-undocumented', currentVersionId: null },
    ]);

    const response = await request(app.getHttpServer())
      .post('/suites/suite-1/confirm-documentation')
      .expect(201);

    expect(prisma.testCase.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['case-documented'] } },
      data: { state: 'active' },
    });
    expect(response.body).toEqual(
      expect.objectContaining({
        suiteId: 'suite-1',
        confirmedCaseIds: ['case-documented'],
        confirmedCount: 1,
        skippedCaseIds: ['case-undocumented'],
        skippedCount: 1,
      }),
    );
  });

  it('answers 404 for confirm-documentation when the suite belongs to another organization', async () => {
    prisma.suite.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post('/suites/suite-1/confirm-documentation')
      .expect(404);
  });

  it('answers 403 for confirm-documentation when a member cannot write to the suite', async () => {
    prisma.orgMember.findFirst.mockResolvedValue({
      organizationId: 'org-1',
      role: 'member',
      organization: { slug: 'acme' },
      user: { locale: 'en' },
    });

    await request(app.getHttpServer())
      .post('/suites/suite-1/confirm-documentation')
      .expect(403);
  });

  it('confirming twice is not an error and confirms nothing the second time', async () => {
    prisma.testCase.findMany.mockResolvedValue([]);

    const response = await request(app.getHttpServer())
      .post('/suites/suite-1/confirm-documentation')
      .expect(201);

    expect(prisma.testCase.updateMany).not.toHaveBeenCalled();
    expect(response.body).toEqual(
      expect.objectContaining({ confirmedCount: 0, skippedCount: 0 }),
    );
  });
});
