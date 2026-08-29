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
import { ProjectsModule } from '../src/modules/projects/projects.module';

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

const projectRow = {
  id: 'project-1',
  name: 'Checkout',
  description: null,
  githubRepo: null,
  technologies: [],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('Projects (e2e)', () => {
  let app: INestApplication<App>;
  const read = jest.fn();
  const prisma = {
    orgMember: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    organization: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
    project: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
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
    prisma.organization.findUniqueOrThrow.mockResolvedValue({ maxProjects: 3 });
    prisma.project.count.mockResolvedValue(0);

    const moduleFixture = await Test.createTestingModule({
      imports: [PrismaModule, AuthModule, OrganizationsModule, ProjectsModule],
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

  it('refuses every project route without a session', async () => {
    read.mockResolvedValue(null);

    await request(app.getHttpServer()).get('/projects').expect(401);
    await request(app.getHttpServer())
      .post('/projects')
      .send({ name: 'Checkout' })
      .expect(401);
  });

  it('bootstraps an organization for a signed-in user who has none', async () => {
    prisma.orgMember.findFirst.mockResolvedValue(null);
    prisma.organization.create.mockResolvedValue({
      id: 'org-new',
      slug: 'ada-lovelaces-workspace',
    });
    prisma.project.findMany.mockResolvedValue([]);

    const response = await request(app.getHttpServer())
      .get('/organizations/current')
      .expect(200);

    expect(response.body).toEqual({
      organizationId: 'org-new',
      slug: 'ada-lovelaces-workspace',
      role: 'owner',
    });
  });

  it('lists only the projects of the resolved organization', async () => {
    prisma.project.findMany.mockResolvedValue([projectRow]);

    const response = await request(app.getHttpServer())
      .get('/projects')
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({ id: 'project-1', name: 'Checkout' }),
    ]);
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' } }),
    );
  });

  it('creates a project and returns 201', async () => {
    prisma.project.create.mockResolvedValue(projectRow);

    const response = await request(app.getHttpServer())
      .post('/projects')
      .send({ name: '  Checkout  ', technologies: ['nestjs'] })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({ id: 'project-1', name: 'Checkout' }),
    );
  });

  it('rejects an invalid body with 400 and the offending path', async () => {
    const response = await request(app.getHttpServer())
      .post('/projects')
      .send({ name: '', githubRepo: 'https://github.com/acme/shop' })
      .expect(400);

    const body = response.body as { issues: { path: string }[] };
    expect(body.issues.map((issue) => issue.path)).toContain('githubRepo');
  });

  it('answers 409 when the project name is already used', async () => {
    prisma.project.create.mockRejectedValue({ code: 'P2002' });

    await request(app.getHttpServer())
      .post('/projects')
      .send({ name: 'Checkout' })
      .expect(409);
  });

  it('answers 403 once the plan allowance is spent', async () => {
    prisma.project.count.mockResolvedValue(3);

    await request(app.getHttpServer())
      .post('/projects')
      .send({ name: 'Checkout' })
      .expect(403);
  });

  it('answers 404 for a project owned by another organization', async () => {
    prisma.project.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer()).get('/projects/project-x').expect(404);
  });

  it('answers 403 when a member tries to delete', async () => {
    prisma.orgMember.findFirst.mockResolvedValue({
      organizationId: 'org-1',
      role: 'member',
      organization: { slug: 'acme' },
    });

    await request(app.getHttpServer())
      .delete('/projects/project-1')
      .expect(403);
  });

  it('deletes with 204 when the caller owns the organization', async () => {
    prisma.project.findFirst.mockResolvedValue({ id: 'project-1' });

    await request(app.getHttpServer())
      .delete('/projects/project-1')
      .expect(204);
    expect(prisma.project.delete).toHaveBeenCalledWith({
      where: { id: 'project-1' },
    });
  });

  it('answers 403 when the organization header names a foreign organization', async () => {
    prisma.orgMember.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/projects')
      .set('x-organization-id', 'org-someone-else')
      .expect(403);
  });
});
