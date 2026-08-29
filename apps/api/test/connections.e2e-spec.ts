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
import type { Env } from '../src/config/env';
import { ConnectionsModule } from '../src/modules/connections/connections.module';
import { REPO_DIRECTORY } from '../src/modules/connections/connections.contracts';
import { OrganizationsModule } from '../src/modules/organizations/organizations.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

const testEnv: Env = {
  NODE_ENV: 'test',
  PORT: 3001,
  DATABASE_URL: 'postgresql://qably:qably@localhost:5432/qably',
  REDIS_URL: 'redis://localhost:6379',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3001',
  WEB_APP_URL: 'http://localhost:3000',
  ENCRYPTION_KEY: 'a'.repeat(64),
  GITHUB_CLIENT_ID: 'gh-client-id',
  GITHUB_CLIENT_SECRET: 'gh-client-secret',
};

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

const connectionRow = {
  id: 'connection-1',
  organizationId: 'org-1',
  provider: 'GITHUB',
  name: 'Primary',
  repo: 'acme/shop',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function assertNoTokenLeak(body: unknown, plaintext: string): void {
  const serialized = JSON.stringify(body);

  expect(serialized).not.toContain(plaintext);
  expect(serialized).not.toMatch(/"token"/);
  expect(serialized).not.toMatch(/"encryptedToken"/);
}

describe('Connections (e2e)', () => {
  let app: INestApplication<App>;
  const read = jest.fn();
  const repoDirectory = {
    listForUser: jest.fn(),
    readManifests: jest.fn(),
  };
  const prisma = {
    orgMember: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    organization: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
    connection: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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
    prisma.connection.findFirst.mockResolvedValue(connectionRow);
    prisma.connection.create.mockResolvedValue(connectionRow);
    prisma.connection.update.mockResolvedValue(connectionRow);

    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule,
        PrismaModule,
        AuthModule,
        OrganizationsModule,
        ConnectionsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(AUTH_INSTANCE)
      .useValue({ handler: () => new Response('{}', { status: 200 }) })
      .overrideProvider(SESSION_READER)
      .useValue({ read })
      .overrideProvider(ENV)
      .useValue(testEnv)
      .overrideProvider(REPO_DIRECTORY)
      .useValue(repoDirectory)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter(false));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('refuses the connection routes without a session', async () => {
    read.mockResolvedValue(null);

    await request(app.getHttpServer()).get('/connections').expect(401);
  });

  it('returns the connections of the caller organization', async () => {
    prisma.connection.findMany.mockResolvedValue([connectionRow]);

    const response = await request(app.getHttpServer())
      .get('/connections')
      .expect(200);

    expect(prisma.connection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' } }),
    );
    expect(response.body).toEqual([
      expect.objectContaining({ id: 'connection-1', repo: 'acme/shop' }),
    ]);
  });

  it('never leaks the token when listing connections', async () => {
    prisma.connection.findMany.mockResolvedValue([connectionRow]);

    const response = await request(app.getHttpServer())
      .get('/connections')
      .expect(200);

    assertNoTokenLeak(response.body, 'ghp_super-secret-token');
  });

  it('creates a connection without ever accepting a pasted token', async () => {
    const response = await request(app.getHttpServer())
      .post('/connections')
      .send({
        provider: 'GITHUB',
        name: 'Primary',
        repo: 'acme/shop',
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({ id: 'connection-1', repo: 'acme/shop' }),
    );
    assertNoTokenLeak(response.body, 'ghp_super-secret-token');

    const [call] = prisma.connection.create.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(call[0].data).not.toHaveProperty('encryptedToken');
  });

  it('returns a single connection without leaking the token', async () => {
    const response = await request(app.getHttpServer())
      .get('/connections/connection-1')
      .expect(200);

    assertNoTokenLeak(response.body, 'ghp_super-secret-token');
  });

  it('rejects a body with an unsupported provider', async () => {
    const response = await request(app.getHttpServer())
      .post('/connections')
      .send({
        provider: 'GITLAB',
        name: 'Primary',
        repo: 'acme/shop',
        token: 't',
      })
      .expect(400);

    const body = response.body as { issues: { path: string }[] };
    expect(body.issues.map((issue) => issue.path)).toContain('provider');
  });

  it('answers 409 when the connection already exists for that repo', async () => {
    prisma.connection.create.mockRejectedValue({ code: 'P2002' });

    await request(app.getHttpServer())
      .post('/connections')
      .send({
        provider: 'GITHUB',
        name: 'Primary',
        repo: 'acme/shop',
      })
      .expect(409);
  });

  it('answers 404 for a connection owned by another organization', async () => {
    prisma.connection.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/connections/connection-x')
      .expect(404);
  });

  it('answers 403 when a member tries to create a connection', async () => {
    prisma.orgMember.findFirst.mockResolvedValue({
      organizationId: 'org-1',
      role: 'member',
      organization: { slug: 'acme' },
    });

    await request(app.getHttpServer())
      .post('/connections')
      .send({
        provider: 'GITHUB',
        name: 'Primary',
        repo: 'acme/shop',
      })
      .expect(403);
  });

  it('answers 403 when a member tries to delete a connection', async () => {
    prisma.orgMember.findFirst.mockResolvedValue({
      organizationId: 'org-1',
      role: 'member',
      organization: { slug: 'acme' },
    });

    await request(app.getHttpServer())
      .delete('/connections/connection-1')
      .expect(403);
  });

  it('deletes with 204 when the caller owns the organization', async () => {
    await request(app.getHttpServer())
      .delete('/connections/connection-1')
      .expect(204);

    expect(prisma.connection.delete).toHaveBeenCalledWith({
      where: { id: 'connection-1' },
    });
  });

  it('refuses an update that only carries a token', async () => {
    await request(app.getHttpServer())
      .patch('/connections/connection-1')
      .send({ token: 'ghp_rotated-secret' })
      .expect(400);

    expect(prisma.connection.update).not.toHaveBeenCalled();
  });

  it('returns the webhook secret once when creating a connection', async () => {
    const response = await request(app.getHttpServer())
      .post('/connections')
      .send({
        provider: 'GITHUB',
        name: 'Primary',
        repo: 'acme/shop',
      })
      .expect(201);

    const { webhookSecret } = response.body as { webhookSecret: string };
    expect(webhookSecret).toMatch(/^[0-9a-f]{64}$/);

    const [call] = prisma.connection.create.mock.calls as [
      [{ data: { encryptedWebhookSecret: string } }],
    ];
    expect(call[0].data.encryptedWebhookSecret).not.toContain(webhookSecret);
    expect(call[0].data.encryptedWebhookSecret.split(':')).toHaveLength(3);
  });

  it('never returns the webhook secret when reading a connection', async () => {
    const response = await request(app.getHttpServer())
      .get('/connections/connection-1')
      .expect(200);

    expect(JSON.stringify(response.body)).not.toContain('webhookSecret');
  });

  it('rotates the webhook secret and returns only the new value', async () => {
    const response = await request(app.getHttpServer())
      .post('/connections/connection-1/webhook-secret')
      .expect(201);

    const body = response.body as Record<string, string>;
    expect(Object.keys(body)).toEqual(['webhookSecret']);
    expect(body.webhookSecret).toMatch(/^[0-9a-f]{64}$/);

    const [call] = prisma.connection.update.mock.calls as [
      [{ data: { encryptedWebhookSecret: string } }],
    ];
    expect(call[0].data.encryptedWebhookSecret).not.toContain(
      body.webhookSecret,
    );
  });

  it('answers 403 when a member tries to rotate the webhook secret', async () => {
    prisma.orgMember.findFirst.mockResolvedValue({
      organizationId: 'org-1',
      role: 'member',
      organization: { slug: 'acme' },
    });

    await request(app.getHttpServer())
      .post('/connections/connection-1/webhook-secret')
      .expect(403);

    expect(prisma.connection.update).not.toHaveBeenCalled();
  });

  it('answers 404 when rotating a connection of another organization', async () => {
    prisma.connection.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post('/connections/connection-1/webhook-secret')
      .expect(404);
  });

  it('answers 403 when the organization header names a foreign organization', async () => {
    prisma.orgMember.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/connections')
      .set('x-organization-id', 'org-someone-else')
      .expect(403);
  });

  it('lists the repositories the signed in user can reach on github', async () => {
    repoDirectory.listForUser.mockResolvedValue([
      {
        id: '1',
        fullName: 'acme/shop',
        isPrivate: true,
        defaultBranch: 'main',
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/connections/available-repos')
      .expect(200);

    expect(repoDirectory.listForUser).toHaveBeenCalledWith('user-1');
    expect(response.body).toEqual([
      expect.objectContaining({ fullName: 'acme/shop' }),
    ]);
  });

  it('does not mistake the repo listing route for a connection id', async () => {
    repoDirectory.listForUser.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/connections/available-repos')
      .expect(200);

    expect(prisma.connection.findFirst).not.toHaveBeenCalled();
  });

  it('detects the stack of a repository from its package.json', async () => {
    repoDirectory.readManifests.mockResolvedValue({
      'package.json': JSON.stringify({
        dependencies: { react: '^19.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      }),
    });

    const response = await request(app.getHttpServer())
      .get('/connections/detect-stack?repo=acme/shop')
      .expect(200);

    expect(repoDirectory.readManifests).toHaveBeenCalledWith(
      'user-1',
      'acme/shop',
    );
    expect((response.body as { technologies: string[] }).technologies).toEqual(
      expect.arrayContaining(['react', 'typescript']),
    );
  });

  it('answers an empty stack when the repository has no readable manifest', async () => {
    repoDirectory.readManifests.mockResolvedValue({});

    const response = await request(app.getHttpServer())
      .get('/connections/detect-stack?repo=acme/shop')
      .expect(200);

    expect((response.body as { technologies: string[] }).technologies).toEqual(
      [],
    );
  });

  it('rejects a detection request without a repository in owner/name form', async () => {
    await request(app.getHttpServer())
      .get('/connections/detect-stack?repo=not-a-repo')
      .expect(400);

    expect(repoDirectory.readManifests).not.toHaveBeenCalled();
  });
});
