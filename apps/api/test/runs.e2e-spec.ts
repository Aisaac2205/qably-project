import { getQueueToken } from '@nestjs/bullmq';
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
import { configureHttpPipeline } from '../src/common/http/configure-http-pipeline';
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
import { RUN_INGEST_QUEUE } from '../src/modules/runs/runs.contracts';
import { RunsModule } from '../src/modules/runs/runs.module';
import type { IngestRunInput } from '../src/modules/runs/runs.schemas';
import { RunsService } from '../src/modules/runs/runs.service';
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

const officialCases = [
  { id: 'case-1', name: 'Adds to cart', automationKey: 'Adds to cart' },
];

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
  ciRunId: null,
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
    testCase: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
    },
    run: { upsert: jest.fn(), groupBy: jest.fn() },
    ciRun: { upsert: jest.fn() },
    runCase: {
      deleteMany: jest.fn(),
      createManyAndReturn: jest.fn(),
      findMany: jest.fn(),
    },
    caseIdentityCollision: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
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
    prisma.testCase.update.mockResolvedValue(officialCases[0]);
    prisma.run.upsert.mockResolvedValue(runRow);
    prisma.run.groupBy.mockResolvedValue([]);
    prisma.ciRun.upsert.mockResolvedValue({ id: 'ci-1' });
    prisma.runCase.deleteMany.mockResolvedValue({ count: 0 });
    prisma.runCase.createManyAndReturn.mockResolvedValue([runCaseRow()]);
    prisma.runCase.findMany.mockResolvedValue([runCaseRow()]);
    prisma.caseIdentityCollision.upsert.mockResolvedValue({});
    prisma.caseIdentityCollision.updateMany.mockResolvedValue({ count: 0 });

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

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureHttpPipeline(app, testEnv);
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
    prisma.runCase.findMany.mockResolvedValue([
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
          {
            suiteId: 'suite-adopted',
            projectId: 'project-1',
            name: 'Adds to cart',
            state: 'draft',
            executionMode: 'automated',
            automationKey: 'Adds to cart',
          },
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

  describe('ci run linking', () => {
    const reportExternalId = 'gha-900-api-junit-unit-xml-ab12cd34';
    const ciFields = { ciRunExternalId: '900', ciJobKey: 'api' };
    const junitXml =
      '<testsuite name="Checkout"><testcase name="Adds to cart"/></testsuite>';

    const postJunit = (query: string) =>
      request(app.getHttpServer())
        .post(`/runs/ingest/junit?${query}`)
        .set('Authorization', `Bearer ${generated.token}`)
        .set('Content-Type', 'application/xml')
        .send(junitXml);

    const enqueuedBodies = () => {
      const queue = app.get<{ addBulk: jest.Mock }>(
        getQueueToken(RUN_INGEST_QUEUE),
      );
      const [jobs] = queue.addBulk.mock.calls[0] as [
        { data: { body: Record<string, unknown> } }[],
      ];
      return jobs.map((job) => job.data.body);
    };

    it('answers a request without ci fields as before and never resolves a ci run', async () => {
      const response = await request(app.getHttpServer())
        .post('/runs/ingest')
        .set('Authorization', `Bearer ${generated.token}`)
        .send(validBody)
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({ id: 'run-1', status: 'pass' }),
      );
      expect(response.body).not.toHaveProperty('ciRunId');
      expect(prisma.ciRun.upsert).not.toHaveBeenCalled();
    });

    it('links the run to its ci run and returns the link', async () => {
      prisma.run.upsert.mockResolvedValue({ ...runRow, ciRunId: 'ci-1' });

      const response = await request(app.getHttpServer())
        .post('/runs/ingest')
        .set('Authorization', `Bearer ${generated.token}`)
        .send({ ...validBody, source: 'github_actions', ...ciFields })
        .expect(200);

      expect(prisma.ciRun.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.ciRun.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId_source_externalId: {
              projectId: 'project-1',
              source: 'github_actions',
              externalId: '900',
            },
          },
        }),
      );
      const [call] = prisma.run.upsert.mock.calls[0] as [
        { create: object; update: object },
      ];
      const link = { ciRunId: 'ci-1', ciJobKey: 'api' };
      expect(call.create).toEqual(expect.objectContaining(link));
      expect(call.update).toEqual(expect.objectContaining(link));
      expect(response.body).toHaveProperty('ciRunId', 'ci-1');
    });

    describe('a report that sends no ci fields but carries the run id in its external id', () => {
      const staleBody = {
        ...validBody,
        externalId: reportExternalId,
        source: 'github_actions',
      };

      const expectLinkedToApiJob = () => {
        expect(prisma.ciRun.upsert).toHaveBeenCalledTimes(1);
        expect(prisma.ciRun.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              projectId_source_externalId: {
                projectId: 'project-1',
                source: 'github_actions',
                externalId: '900',
              },
            },
          }),
        );
        const [call] = prisma.run.upsert.mock.calls[0] as [
          { create: object; update: object },
        ];
        const link = { ciRunId: 'ci-1', ciJobKey: 'api' };
        expect(call.create).toEqual(expect.objectContaining(link));
        expect(call.update).toEqual(expect.objectContaining(link));
      };

      it('links a run posted to the json route and keeps the job known from the project', async () => {
        prisma.run.groupBy.mockResolvedValue([{ ciJobKey: 'api' }]);
        prisma.run.upsert.mockResolvedValue({ ...runRow, ciRunId: 'ci-1' });

        const response = await request(app.getHttpServer())
          .post('/runs/ingest')
          .set('Authorization', `Bearer ${generated.token}`)
          .send(staleBody)
          .expect(200);

        expectLinkedToApiJob();
        expect(response.body).toHaveProperty('ciRunId', 'ci-1');
      });

      it('links a queued junit report once the worker ingests it', async () => {
        prisma.run.groupBy.mockResolvedValue([{ ciJobKey: 'api' }]);

        await postJunit(
          `externalId=${reportExternalId}&source=github_actions`,
        ).expect(202);
        const [body] = enqueuedBodies();
        expect(Object.keys(body).filter((key) => key.startsWith('ci'))).toEqual(
          [],
        );

        await app.get(RunsService).ingest(
          {
            apiKeyId: 'key-1',
            projectId: 'project-1',
            organizationId: 'org-1',
          },
          body as unknown as IngestRunInput,
        );

        expectLinkedToApiJob();
      });

      it('leaves a local reporter run unlinked', async () => {
        await request(app.getHttpServer())
          .post('/runs/ingest')
          .set('Authorization', `Bearer ${generated.token}`)
          .send({
            ...staleBody,
            externalId: 'gha-local-job-junit-unit-xml-3425dd6f',
          })
          .expect(200);

        expect(prisma.ciRun.upsert).not.toHaveBeenCalled();
        expect(prisma.run.groupBy).not.toHaveBeenCalled();
      });
    });

    it.each([
      ['a counter above the 32-bit range', { ciRunNumber: 99_999_999_999 }],
      ['a non-http ciServerUrl', { ciServerUrl: 'javascript:alert(1)' }],
      ['an empty job key', { ciJobKey: '' }],
    ])('rejects %s with a 400 before any write', async (_label, extra) => {
      await request(app.getHttpServer())
        .post('/runs/ingest')
        .set('Authorization', `Bearer ${generated.token}`)
        .send({ ...validBody, ...ciFields, ...extra })
        .expect(400);

      expect(prisma.ciRun.upsert).not.toHaveBeenCalled();
      expect(prisma.run.upsert).not.toHaveBeenCalled();
    });

    describe('ciServerUrl normalization', () => {
      const dirtyUrl = 'https://user:pw@github.com/x?token=abc#frag';
      const origin = 'https://github.com';

      const upsertedServerUrls = () => {
        const [call] = prisma.ciRun.upsert.mock.calls[0] as [
          { create: { serverUrl?: string }; update: { serverUrl?: string } },
        ];
        return [call.create.serverUrl, call.update.serverUrl];
      };

      it('stores only the origin of a ciServerUrl sent to the json route', async () => {
        await request(app.getHttpServer())
          .post('/runs/ingest')
          .set('Authorization', `Bearer ${generated.token}`)
          .send({
            ...validBody,
            source: 'github_actions',
            ...ciFields,
            ciServerUrl: dirtyUrl,
          })
          .expect(200);

        expect(upsertedServerUrls()).toEqual([origin, origin]);
      });

      it('enqueues and then stores only the origin of a ciServerUrl sent to the junit route', async () => {
        await postJunit(
          `externalId=${reportExternalId}&source=github_actions&ciRunExternalId=900&ciServerUrl=${encodeURIComponent(dirtyUrl)}`,
        ).expect(202);

        const [body] = enqueuedBodies();
        expect(body.ciServerUrl).toBe(origin);
        expect(JSON.stringify(body)).not.toContain('token=abc');

        await app.get(RunsService).ingest(
          {
            apiKeyId: 'key-1',
            projectId: 'project-1',
            organizationId: 'org-1',
          },
          body as unknown as IngestRunInput,
        );

        expect(upsertedServerUrls()).toEqual([origin, origin]);
      });

      it('keeps the payload of the reporter unchanged when it sends an origin', async () => {
        await postJunit(
          `externalId=${reportExternalId}&source=github_actions&ciRunExternalId=900&ciServerUrl=${encodeURIComponent(origin)}`,
        ).expect(202);

        expect(enqueuedBodies()[0].ciServerUrl).toBe(origin);
      });
    });

    it('accepts a junit report without ci fields with a 202 and the same shape as before', async () => {
      const response = await postJunit(`externalId=${reportExternalId}`).expect(
        202,
      );

      expect(response.body).toEqual(
        expect.objectContaining({
          accepted: 1,
          runs: [
            expect.objectContaining({
              externalId: reportExternalId,
              suiteName: 'Checkout',
            }) as unknown,
          ],
          rejected: [],
        }),
      );
      const [body] = enqueuedBodies();
      expect(Object.keys(body).filter((key) => key.startsWith('ci'))).toEqual(
        [],
      );
    });

    it('carries the ci query parameters into the enqueued job body', async () => {
      await postJunit(
        `externalId=${reportExternalId}&source=github_actions&ciRunExternalId=900&ciJobKey=api&ciRunNumber=42`,
      ).expect(202);

      expect(enqueuedBodies()).toEqual([
        expect.objectContaining({
          ciRunExternalId: '900',
          ciJobKey: 'api',
          ciRunNumber: 42,
        }) as unknown,
      ]);
    });

    it.each([
      ['a 256 character job key', `ciJobKey=${'a'.repeat(256)}`],
      ['a counter above the 32-bit range', 'ciRunNumber=2147483648'],
    ])('answers 400 on the junit route for %s', async (_label, query) => {
      await postJunit(`externalId=${reportExternalId}&${query}`).expect(400);
    });
  });
});
