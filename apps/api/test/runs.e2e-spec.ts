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
import {
  generateApiKeyToken,
  hashApiKeySecret,
} from '../src/modules/api-keys/lib/token';
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
  },
  sessionId: 'session-1',
  expiresAt: new Date('2030-01-01T00:00:00.000Z'),
};

const generated = generateApiKeyToken();
const revoked = generateApiKeyToken();

const activeKeyRow = {
  id: 'key-1',
  projectId: 'project-1',
  organizationId: 'org-1',
  name: 'CI/CD Pipeline',
  lookupId: generated.lookupId,
  hashedSecret: hashApiKeySecret(generated.secret),
  lastFour: generated.lastFour,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  lastUsedAt: null,
  revokedAt: null,
};

const revokedKeyRow = {
  ...activeKeyRow,
  id: 'key-2',
  lookupId: revoked.lookupId,
  hashedSecret: hashApiKeySecret(revoked.secret),
  lastFour: revoked.lastFour,
  revokedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const suiteRow = { id: 'suite-1', name: 'Checkout' };

const officialCases = [{ id: 'case-1', name: 'Adds to cart' }];

const runRow = {
  id: 'run-1',
  projectId: 'project-1',
  organizationId: 'org-1',
  suiteId: 'suite-1',
  name: 'Checkout regression',
  status: 'pass' as const,
  source: 'api' as const,
  externalId: 'ci-run-42',
  startedAt: new Date('2026-01-01T00:00:00.000Z'),
  finishedAt: null,
  executedById: null,
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
    steps: [],
    expectedResult: '',
    status: 'pass' as const,
    position: 0,
    recordedAt: null,
    ...overrides,
  };
}

const validBody = {
  externalId: 'ci-run-42',
  suiteId: 'suite-1',
  name: 'Checkout regression',
  cases: [{ name: 'Adds to cart', status: 'pass' }],
};

describe('Runs ingestion (e2e)', () => {
  let app: INestApplication<App>;
  const read = jest.fn();
  const prisma = {
    apiKey: { findUnique: jest.fn(), update: jest.fn() },
    suite: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    testCase: { findMany: jest.fn(), createMany: jest.fn() },
    run: { upsert: jest.fn() },
    runCase: { deleteMany: jest.fn(), createManyAndReturn: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    read.mockResolvedValue(session);
    prisma.$transaction.mockImplementation(
      (run: (tx: typeof prisma) => unknown) => run(prisma),
    );
    prisma.apiKey.findUnique.mockImplementation(
      ({ where }: { where: { lookupId: string } }) => {
        if (where.lookupId === activeKeyRow.lookupId)
          return Promise.resolve(activeKeyRow);
        if (where.lookupId === revokedKeyRow.lookupId)
          return Promise.resolve(revokedKeyRow);
        return Promise.resolve(null);
      },
    );
    prisma.apiKey.update.mockResolvedValue(activeKeyRow);
    prisma.suite.findFirst.mockResolvedValue(suiteRow);
    prisma.suite.create.mockResolvedValue({
      id: 'suite-adopted',
      name: 'New Suite',
    });
    prisma.suite.findFirstOrThrow.mockResolvedValue(suiteRow);
    prisma.testCase.findMany.mockResolvedValue(officialCases);
    prisma.testCase.createMany.mockResolvedValue({ count: 0 });
    prisma.run.upsert.mockResolvedValue(runRow);
    prisma.runCase.deleteMany.mockResolvedValue({ count: 0 });
    prisma.runCase.createManyAndReturn.mockResolvedValue([runCaseRow()]);

    const moduleFixture = await stubQueues(
      Test.createTestingModule({
        imports: [
          ConfigModule,
          PrismaModule,
          AuthModule,
          OrganizationsModule,
          ApiKeysModule,
          RunsModule,
        ],
      }),
    )
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

  it('rejects a request without an authorization header', async () => {
    await request(app.getHttpServer())
      .post('/runs/ingest')
      .send(validBody)
      .expect(401);
  });

  it('rejects a garbage bearer token', async () => {
    await request(app.getHttpServer())
      .post('/runs/ingest')
      .set('Authorization', 'Bearer not-a-real-token')
      .send(validBody)
      .expect(401);
  });

  it('rejects a revoked api key', async () => {
    await request(app.getHttpServer())
      .post('/runs/ingest')
      .set('Authorization', `Bearer ${revoked.token}`)
      .send(validBody)
      .expect(401);
  });

  it('ingests a run with a real api key and answers 200', async () => {
    const response = await request(app.getHttpServer())
      .post('/runs/ingest')
      .set('Authorization', `Bearer ${generated.token}`)
      .send(validBody)
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({ id: 'run-1', status: 'pass' }),
    );
    expect(response.body).toHaveProperty('cases');
    expect((response.body as { cases: unknown[] }).cases).toHaveLength(1);
  });

  it('replays the same externalId idempotently into a single run', async () => {
    const first = await request(app.getHttpServer())
      .post('/runs/ingest')
      .set('Authorization', `Bearer ${generated.token}`)
      .send(validBody)
      .expect(200);

    const second = await request(app.getHttpServer())
      .post('/runs/ingest')
      .set('Authorization', `Bearer ${generated.token}`)
      .send(validBody)
      .expect(200);

    expect((first.body as { id: string }).id).toBe('run-1');
    expect((second.body as { id: string }).id).toBe('run-1');
    expect(prisma.run.upsert).toHaveBeenCalledTimes(2);

    const calls = prisma.run.upsert.mock.calls as [
      { where: unknown; update: object },
    ][];
    expect(calls[0][0].where).toEqual(calls[1][0].where);
    expect(calls[0][0].update).toEqual(calls[1][0].update);
  });

  it('answers 404 when the suite does not belong to the api key project', async () => {
    prisma.suite.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post('/runs/ingest')
      .set('Authorization', `Bearer ${generated.token}`)
      .send(validBody)
      .expect(404);
  });

  it('rejects source manual with a 400', async () => {
    await request(app.getHttpServer())
      .post('/runs/ingest')
      .set('Authorization', `Bearer ${generated.token}`)
      .send({ ...validBody, source: 'manual' })
      .expect(400);
  });

  it('rejects a payload without cases', async () => {
    await request(app.getHttpServer())
      .post('/runs/ingest')
      .set('Authorization', `Bearer ${generated.token}`)
      .send({ ...validBody, cases: [] })
      .expect(400);
  });

  it('adopts an unknown suiteName instead of 404ing, creating the suite and draft cases', async () => {
    prisma.suite.findFirst.mockResolvedValue(null);
    prisma.testCase.findMany.mockResolvedValue([]);
    prisma.runCase.createManyAndReturn.mockResolvedValue([
      runCaseRow({ testCaseId: 'draft-case-1' }),
    ]);

    const response = await request(app.getHttpServer())
      .post('/runs/ingest')
      .set('Authorization', `Bearer ${generated.token}`)
      .send({
        externalId: 'gh-run-1',
        suiteName: 'New Suite',
        name: 'First CI report',
        cases: [{ name: 'Adds to cart', status: 'pass' }],
      })
      .expect(200);

    expect(prisma.suite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'New Suite' }) as unknown,
      }),
    );
    expect(prisma.testCase.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          { suiteId: 'suite-adopted', name: 'Adds to cart', state: 'draft' },
        ],
      }),
    );
    expect(response.body).toHaveProperty('id', 'run-1');
  });

  it('still 404s when suiteId is given and does not resolve, even though suiteName would adopt', async () => {
    prisma.suite.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post('/runs/ingest')
      .set('Authorization', `Bearer ${generated.token}`)
      .send({ ...validBody, suiteId: 'suite-missing' })
      .expect(404);

    expect(prisma.suite.create).not.toHaveBeenCalled();
  });
});
