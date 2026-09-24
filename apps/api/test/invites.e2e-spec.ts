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
import { InvitesModule } from '../src/modules/invites/invites.module';
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

const memberSession: SessionContext = {
  user: {
    id: 'user-member',
    email: 'bob@acme.test',
    name: 'Bob',
    emailVerified: true,
    locale: null,
  },
  sessionId: 'session-member',
  expiresAt: new Date('2030-01-01T00:00:00.000Z'),
};

const inviteeSession: SessionContext = {
  user: {
    id: 'user-invitee',
    email: 'grace@acme.test',
    name: 'Grace Hopper',
    emailVerified: true,
    locale: null,
  },
  sessionId: 'session-invitee',
  expiresAt: new Date('2030-01-01T00:00:00.000Z'),
};

const inviteRow = {
  id: 'invite-1',
  organizationId: 'org-1',
  email: 'grace@acme.test',
  role: 'member',
  tokenHash: 'a'.repeat(64),
  expiresAt: new Date('2099-01-01T00:00:00.000Z'),
  acceptedAt: null,
  revokedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  invitedBy: { name: 'Ada Lovelace' },
};

describe('Invites (e2e)', () => {
  let app: INestApplication<App>;
  const read = jest.fn();
  const prisma = {
    orgMember: {
      findFirst: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
    },
    orgInvite: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    organization: { findUnique: jest.fn() },
    user: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    read.mockResolvedValue(ownerSession);
    prisma.$transaction.mockImplementation(
      (run: (tx: typeof prisma) => unknown) => run(prisma),
    );
    prisma.orgMember.findFirst.mockImplementation(
      (args: { where: { user?: unknown } }) =>
        Promise.resolve(
          args.where.user === undefined
            ? {
                organizationId: 'org-1',
                role: 'owner',
                organization: { slug: 'acme' },
              }
            : null,
        ),
    );
    prisma.orgMember.count.mockResolvedValue(0);
    prisma.orgMember.upsert.mockResolvedValue({});
    prisma.orgInvite.count.mockResolvedValue(0);
    prisma.orgInvite.findFirst.mockResolvedValue(null);
    prisma.orgInvite.findUnique.mockResolvedValue(null);
    prisma.orgInvite.findMany.mockResolvedValue([]);
    prisma.orgInvite.create.mockResolvedValue(inviteRow);
    prisma.orgInvite.update.mockResolvedValue(inviteRow);
    prisma.orgInvite.updateMany.mockResolvedValue({ count: 1 });
    prisma.organization.findUnique.mockResolvedValue({ name: 'Acme' });
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.$queryRaw.mockResolvedValue([{ plan: 'equipo' }]);

    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule,
        PrismaModule,
        AuthModule,
        OrganizationsModule,
        InvitesModule,
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

  it('refuses every org-scoped invite route without a session', async () => {
    read.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/organizations/current/invites')
      .expect(401);
    await request(app.getHttpServer())
      .post('/organizations/current/invites')
      .send({ email: 'grace@acme.test', role: 'member' })
      .expect(401);
  });

  it('refuses accept without a session but allows preview without one', async () => {
    read.mockResolvedValue(null);
    prisma.orgInvite.findUnique.mockResolvedValue({
      email: 'grace@acme.test',
      role: 'member',
      acceptedAt: null,
      revokedAt: null,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      organization: { name: 'Acme' },
      invitedBy: { name: 'Ada Lovelace' },
    });

    await request(app.getHttpServer())
      .post('/invites/accept')
      .send({ token: 'some-token' })
      .expect(401);

    const response = await request(app.getHttpServer())
      .post('/invites/preview')
      .send({ token: 'some-token' })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({ organizationName: 'Acme', status: 'pending' }),
    );
  });

  it('answers 403 when a plain member tries to create an invite', async () => {
    prisma.orgMember.findFirst.mockResolvedValue({
      organizationId: 'org-1',
      role: 'member',
      organization: { slug: 'acme' },
    });

    const response = await request(app.getHttpServer())
      .post('/organizations/current/invites')
      .send({ email: 'grace@acme.test', role: 'member' })
      .expect(403);

    expect((response.body as { code: string }).code).toBe('forbidden');
  });

  it('creates an invite and never returns the raw token', async () => {
    const response = await request(app.getHttpServer())
      .post('/organizations/current/invites')
      .send({ email: 'Grace@Acme.test', role: 'member' })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: 'invite-1',
        email: 'grace@acme.test',
        role: 'member',
        emailDelivered: true,
      }),
    );
    expect(JSON.stringify(response.body)).not.toMatch(/token/i);
  });

  it('rejects an invalid email with 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/organizations/current/invites')
      .send({ email: 'not-an-email', role: 'member' })
      .expect(400);

    const body = response.body as { issues: { path: string }[] };
    expect(body.issues.map((issue) => issue.path)).toContain('email');
  });

  it('answers 403 seat-limit-reached once the plan seat cap is spent', async () => {
    prisma.$queryRaw.mockResolvedValue([{ plan: 'gratuito' }]);
    prisma.orgMember.count.mockResolvedValue(3);

    const response = await request(app.getHttpServer())
      .post('/organizations/current/invites')
      .send({ email: 'grace@acme.test', role: 'member' })
      .expect(403);

    expect((response.body as { code: string }).code).toBe('seat-limit-reached');
    expect(prisma.orgInvite.create).not.toHaveBeenCalled();
  });

  it('answers 409 already-member for an email that already belongs to the organization', async () => {
    prisma.orgMember.findFirst.mockImplementation(
      (args: { where: { user?: unknown } }) =>
        Promise.resolve(
          args.where.user === undefined
            ? {
                organizationId: 'org-1',
                role: 'owner',
                organization: { slug: 'acme' },
              }
            : { id: 'member-1' },
        ),
    );

    const response = await request(app.getHttpServer())
      .post('/organizations/current/invites')
      .send({ email: 'grace@acme.test', role: 'member' })
      .expect(409);

    expect((response.body as { code: string }).code).toBe('already-member');
  });

  it('lists pending invites for the organization', async () => {
    prisma.orgInvite.findMany.mockResolvedValue([inviteRow]);

    const response = await request(app.getHttpServer())
      .get('/organizations/current/invites')
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({ id: 'invite-1', email: 'grace@acme.test' }),
    ]);
  });

  it('revokes a pending invite with 204', async () => {
    await request(app.getHttpServer())
      .delete('/organizations/current/invites/invite-1')
      .expect(204);

    const [revokeArgs] = prisma.orgInvite.updateMany.mock.calls[0] as [
      { where: { id: string } },
    ];
    expect(revokeArgs.where).toEqual(
      expect.objectContaining({ id: 'invite-1' }),
    );
  });

  it('answers 404 when revoking an invite outside the caller organization', async () => {
    prisma.orgInvite.updateMany.mockResolvedValue({ count: 0 });

    await request(app.getHttpServer())
      .delete('/organizations/current/invites/invite-foreign')
      .expect(404);
  });

  it('resends an invite by rotating its token', async () => {
    prisma.orgInvite.findUnique.mockResolvedValue(inviteRow);

    const response = await request(app.getHttpServer())
      .post('/organizations/current/invites/invite-1/resend')
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({ id: 'invite-1', emailDelivered: true }),
    );
  });

  it('previews an unknown token with 404', async () => {
    await request(app.getHttpServer())
      .post('/invites/preview')
      .send({ token: 'unknown-token' })
      .expect(404);
  });

  it('accepts a matching invite and returns the organization id', async () => {
    read.mockResolvedValue(inviteeSession);
    prisma.orgInvite.findUnique.mockResolvedValue({
      id: 'invite-1',
      organizationId: 'org-1',
      email: 'grace@acme.test',
      role: 'member',
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      acceptedAt: null,
      revokedAt: null,
    });

    const response = await request(app.getHttpServer())
      .post('/invites/accept')
      .send({ token: 'some-token' })
      .expect(201);

    expect(response.body).toEqual({ organizationId: 'org-1' });
    expect(prisma.orgMember.upsert).toHaveBeenCalledTimes(1);
  });

  it('answers 403 invite-email-mismatch when the session email differs', async () => {
    read.mockResolvedValue(memberSession);
    prisma.orgInvite.findUnique.mockResolvedValue({
      id: 'invite-1',
      organizationId: 'org-1',
      email: 'grace@acme.test',
      role: 'member',
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      acceptedAt: null,
      revokedAt: null,
    });

    const response = await request(app.getHttpServer())
      .post('/invites/accept')
      .send({ token: 'some-token' })
      .expect(403);

    expect((response.body as { code: string }).code).toBe(
      'invite-email-mismatch',
    );
    expect(prisma.orgMember.upsert).not.toHaveBeenCalled();
  });

  it('answers 410 invite-expired for a token past its expiry', async () => {
    read.mockResolvedValue(inviteeSession);
    prisma.orgInvite.findUnique.mockResolvedValue({
      id: 'invite-1',
      organizationId: 'org-1',
      email: 'grace@acme.test',
      role: 'member',
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      acceptedAt: null,
      revokedAt: null,
    });

    const response = await request(app.getHttpServer())
      .post('/invites/accept')
      .send({ token: 'some-token' })
      .expect(410);

    expect((response.body as { code: string }).code).toBe('invite-expired');
  });

  it('answers 404 invite-invalid-or-used for a token that was already claimed', async () => {
    read.mockResolvedValue(inviteeSession);
    prisma.orgInvite.findUnique.mockResolvedValue({
      id: 'invite-1',
      organizationId: 'org-1',
      email: 'grace@acme.test',
      role: 'member',
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      acceptedAt: new Date('2026-01-01T00:00:00.000Z'),
      revokedAt: null,
    });

    const response = await request(app.getHttpServer())
      .post('/invites/accept')
      .send({ token: 'some-token' })
      .expect(404);

    expect((response.body as { code: string }).code).toBe(
      'invite-invalid-or-used',
    );
  });
});
