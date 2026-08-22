import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  SESSION_READER,
  type SessionContext,
} from '../src/auth/auth.contracts';
import { AUTH_INSTANCE } from '../src/auth/auth.instance';
import { AuthModule } from '../src/auth/auth.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { OrganizationsModule } from '../src/organizations/organizations.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SuitesModule } from '../src/suites/suites.module';

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
    organization: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
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
    testCase: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    $transaction: jest.fn(),
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
    });
    prisma.project.findFirst.mockResolvedValue({ id: 'project-1' });
    prisma.suite.findFirst.mockResolvedValue(suiteRow);
    prisma.suite.findUniqueOrThrow.mockResolvedValue(suiteRow);
    prisma.suite.create.mockResolvedValue(suiteRow);
    prisma.suite.update.mockResolvedValue(suiteRow);

    const moduleFixture = await Test.createTestingModule({
      imports: [PrismaModule, AuthModule, OrganizationsModule, SuitesModule],
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
});
