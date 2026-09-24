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
import { testEnv } from './support/test-env';

const ownerSession: SessionContext = {
  user: {
    id: 'user-owner',
    email: 'ada@acme.test',
    name: 'Ada Lovelace',
    emailVerified: true,
    locale: null,
  },
  sessionId: 'session-owner',
  expiresAt: new Date('2030-01-01T00:00:00.000Z'),
};

const membership = {
  organizationId: 'org-1',
  role: 'owner',
  organization: { slug: 'acme' },
};

const ownerRow = {
  id: 'member-1',
  userId: 'user-owner',
  role: 'owner',
  joinedAt: new Date('2026-01-01T00:00:00.000Z'),
  user: { name: 'Ada Lovelace', email: 'ada@acme.test', image: null },
};

const adminRow = {
  id: 'member-2',
  userId: 'user-admin',
  role: 'admin',
  joinedAt: new Date('2026-01-02T00:00:00.000Z'),
  user: { name: 'Grace Hopper', email: 'grace@acme.test', image: null },
};

describe('Organizations (e2e)', () => {
  let app: INestApplication<App>;
  const read = jest.fn();
  const prisma = {
    orgMember: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    orgInvite: { count: jest.fn() },
    project: { count: jest.fn() },
    organization: { findUniqueOrThrow: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    read.mockResolvedValue(ownerSession);
    prisma.$transaction.mockImplementation(
      (run: (tx: typeof prisma) => unknown) => run(prisma),
    );
    prisma.orgMember.findFirst.mockResolvedValue(membership);
    prisma.orgMember.findMany.mockResolvedValue([]);
    prisma.orgMember.count.mockResolvedValue(2);
    prisma.orgMember.update.mockResolvedValue({ ...adminRow, role: 'owner' });
    prisma.orgMember.delete.mockResolvedValue({});
    prisma.orgInvite.count.mockResolvedValue(0);
    prisma.project.count.mockResolvedValue(1);
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      plan: 'equipo',
      aiEnabled: true,
      aiCreditsUsed: 12,
      aiCreditsPeriodStart: new Date('2026-09-01T00:00:00.000Z'),
    });
    prisma.$queryRaw.mockResolvedValue([{ plan: 'equipo' }]);

    const moduleFixture = await Test.createTestingModule({
      imports: [ConfigModule, PrismaModule, AuthModule, OrganizationsModule],
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

  it('lists organizations even with a stale x-organization-id header', async () => {
    const response = await request(app.getHttpServer())
      .get('/organizations')
      .set('x-organization-id', 'org-does-not-exist')
      .expect(200);

    expect(response.body).toEqual([]);
    expect(prisma.orgMember.findFirst).not.toHaveBeenCalled();
  });

  it('answers 403 not-a-member with a code when /organizations/current uses a stale header', async () => {
    prisma.orgMember.findFirst.mockImplementation(
      (args: { where: { organizationId?: string } }) =>
        Promise.resolve(
          args.where.organizationId === 'org-does-not-exist'
            ? null
            : membership,
        ),
    );

    const response = await request(app.getHttpServer())
      .get('/organizations/current')
      .set('x-organization-id', 'org-does-not-exist')
      .expect(403);

    expect((response.body as { code: string }).code).toBe('not-a-member');
  });

  it('reports organization usage from real plan limits and counts', async () => {
    const response = await request(app.getHttpServer())
      .get('/organizations/current/usage')
      .expect(200);

    expect(response.body).toEqual({
      plan: 'equipo',
      limits: {
        members: 10,
        projects: 5,
        monthlyAiCredits: 300,
        notificationIntegrations: true,
      },
      members: 2,
      pendingInvites: 0,
      projects: 1,
      aiEnabled: true,
      aiCreditsUsed: 12,
      creditsResetAt: expect.any(String) as string,
    });
  });

  it('lists organization members for an owner', async () => {
    prisma.orgMember.findMany.mockResolvedValue([ownerRow, adminRow]);

    const response = await request(app.getHttpServer())
      .get('/organizations/current/members')
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({ id: 'member-1', role: 'owner' }),
      expect.objectContaining({ id: 'member-2', role: 'admin' }),
    ]);
  });

  it('promotes a member to owner when the caller is an owner', async () => {
    prisma.orgMember.findFirst.mockImplementation(
      (args: { where: { id?: string; organizationId?: string } }) =>
        Promise.resolve(args.where.id === 'member-2' ? adminRow : membership),
    );

    const response = await request(app.getHttpServer())
      .patch('/organizations/current/members/member-2')
      .send({ role: 'owner' })
      .expect(200);

    expect((response.body as { role: string }).role).toBe('owner');
  });

  it('answers 409 last-owner-required when demoting the sole owner', async () => {
    prisma.orgMember.findFirst.mockImplementation(
      (args: { where: { id?: string; organizationId?: string } }) =>
        Promise.resolve(args.where.id === 'member-1' ? ownerRow : membership),
    );
    prisma.orgMember.count.mockResolvedValue(1);

    const response = await request(app.getHttpServer())
      .patch('/organizations/current/members/member-1')
      .send({ role: 'admin' })
      .expect(409);

    expect((response.body as { code: string }).code).toBe(
      'last-owner-required',
    );
    expect(prisma.orgMember.update).not.toHaveBeenCalled();
  });

  it('answers 409 last-owner-required when removing the sole owner', async () => {
    prisma.orgMember.findFirst.mockImplementation(
      (args: { where: { id?: string; organizationId?: string } }) =>
        Promise.resolve(args.where.id === 'member-1' ? ownerRow : membership),
    );
    prisma.orgMember.count.mockResolvedValue(1);

    const response = await request(app.getHttpServer())
      .delete('/organizations/current/members/member-1')
      .expect(409);

    expect((response.body as { code: string }).code).toBe(
      'last-owner-required',
    );
    expect(prisma.orgMember.delete).not.toHaveBeenCalled();
  });

  it('removes a plain member with 204', async () => {
    prisma.orgMember.findFirst.mockImplementation(
      (args: { where: { id?: string; organizationId?: string } }) =>
        Promise.resolve(args.where.id === 'member-2' ? adminRow : membership),
    );

    await request(app.getHttpServer())
      .delete('/organizations/current/members/member-2')
      .expect(204);

    expect(prisma.orgMember.delete).toHaveBeenCalledWith({
      where: { id: 'member-2' },
    });
  });

  it('answers 403 forbidden when a plain member calls a member-management route', async () => {
    prisma.orgMember.findFirst.mockResolvedValue({
      ...membership,
      role: 'member',
    });

    const response = await request(app.getHttpServer())
      .get('/organizations/current/members')
      .expect(403);

    expect((response.body as { code: string }).code).toBe('forbidden');
  });
});
