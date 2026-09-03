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
import { ApiKeysModule } from '../src/modules/api-keys/api-keys.module';
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

const keyRow = {
  id: 'key-1',
  projectId: 'project-1',
  organizationId: 'org-1',
  name: 'CI/CD Pipeline',
  lookupId: 'a1b2c3d4e5f6',
  lastFour: 'cafe',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  lastUsedAt: null,
  revokedAt: null,
};

const BASE = '/projects/project-1/api-keys';

describe('Api keys (e2e)', () => {
  let app: INestApplication<App>;
  const read = jest.fn();
  const prisma = {
    orgMember: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    organization: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
    project: { findFirst: jest.fn() },
    apiKey: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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
    prisma.project.findFirst.mockResolvedValue({ id: 'project-1' });
    prisma.apiKey.findMany.mockResolvedValue([keyRow]);
    prisma.apiKey.findFirst.mockResolvedValue(keyRow);
    prisma.apiKey.create.mockResolvedValue(keyRow);
    prisma.apiKey.update.mockResolvedValue({
      ...keyRow,
      revokedAt: new Date('2026-02-01T00:00:00.000Z'),
    });

    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule,
        PrismaModule,
        AuthModule,
        OrganizationsModule,
        ApiKeysModule,
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
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter(false));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('refuses the api key routes without a session', async () => {
    read.mockResolvedValue(null);

    await request(app.getHttpServer()).get(BASE).expect(401);
  });

  it('lists the keys of the project without the stored hash', async () => {
    const response = await request(app.getHttpServer()).get(BASE).expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({ id: 'key-1', lastFour: 'cafe' }),
    ]);
    expect(JSON.stringify(response.body)).not.toMatch(/hashedSecret/);
  });

  it('answers 404 for a project outside the caller organization', async () => {
    prisma.project.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer()).get(BASE).expect(404);
  });

  it('returns the plaintext token once when issuing a key', async () => {
    const response = await request(app.getHttpServer())
      .post(BASE)
      .send({ name: 'CI/CD Pipeline' })
      .expect(201);

    expect((response.body as { token: string }).token).toMatch(
      /^qbly_[0-9a-f]+_[0-9a-f]+$/,
    );
  });

  it('rejects an unnamed key', async () => {
    await request(app.getHttpServer())
      .post(BASE)
      .send({ name: '' })
      .expect(400);
  });

  it('forbids a member from issuing a key', async () => {
    prisma.orgMember.findFirst.mockResolvedValue({
      organizationId: 'org-1',
      role: 'member',
      organization: { slug: 'acme' },
    });

    await request(app.getHttpServer())
      .post(BASE)
      .send({ name: 'CI/CD Pipeline' })
      .expect(403);
  });

  it('revokes a key without deleting it', async () => {
    const response = await request(app.getHttpServer())
      .post(`${BASE}/key-1/revoke`)
      .expect(200);

    expect(prisma.apiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { revokedAt: expect.any(Date) as Date },
      }),
    );
    expect((response.body as { revokedAt: string }).revokedAt).toBe(
      '2026-02-01T00:00:00.000Z',
    );
  });

  it('answers 404 when revoking a key of another project', async () => {
    prisma.apiKey.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer()).post(`${BASE}/key-9/revoke`).expect(404);
  });
});
