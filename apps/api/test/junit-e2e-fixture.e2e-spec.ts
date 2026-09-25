import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import express from 'express';
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
import { isErr } from '../src/common/result';
import { OrganizationsModule } from '../src/modules/organizations/organizations.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { groupJunitReportBySuite } from '../src/modules/runs/lib/group-junit-report';
import { parseJunitXml } from '../src/modules/runs/lib/parse-junit-xml';
import { REPORT_BATCH_REDIS } from '../src/modules/runs/report-batch.tokens';
import {
  RUN_INGEST_QUEUE,
  type RunIngestJobData,
  type RunView,
} from '../src/modules/runs/runs.contracts';
import { RunsModule } from '../src/modules/runs/runs.module';
import { RunsService } from '../src/modules/runs/runs.service';
import { stubQueues } from './support/stub-queues';
import { testEnv } from './support/test-env';

const fixturePath = join(__dirname, 'fixtures/junit-e2e.xml');
const fixtureXml = readFileSync(fixturePath, 'utf8');

const projectId = 'project-1';
const organizationId = 'org-1';

interface FakeApiKeyRow {
  id: string;
  projectId: string;
  organizationId: string;
  lookupId: string;
  hashedSecret: string;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
}

interface FakeSuiteRow {
  id: string;
  name: string;
  projectId: string;
  organizationId: string;
  ingestionKey: string | null;
}

interface FakeTestCaseRow {
  id: string;
  suiteId: string;
  projectId: string;
  name: string;
  state: string;
  executionMode: string;
  automationKey: string | null;
  automationClassName: string | null;
  automationFilePath: string | null;
}

interface FakeRunRow {
  id: string;
  projectId: string;
  organizationId: string;
  suiteId: string;
  name: string;
  status: string;
  source: string;
  externalId: string;
  reportExternalId: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  executedById: string | null;
  commitSha: string | null;
  commitMessage: string | null;
  commitAuthor: string | null;
}

interface FakeRunCaseRow {
  id: string;
  runId: string;
  testCaseId: string | null;
  name: string;
  suiteName: string;
  steps: string[];
  expectedResult: string;
  status: string;
  position: number;
  recordedAt: Date | null;
  className: string | null;
  filePath: string | null;
  durationMs: number | null;
  failureType: string | null;
  failureMessage: string | null;
  failureDetails: string | null;
  skipReason: string | null;
}

type FakeRunCaseInput = Pick<
  FakeRunCaseRow,
  | 'runId'
  | 'testCaseId'
  | 'name'
  | 'suiteName'
  | 'steps'
  | 'expectedResult'
  | 'status'
  | 'position'
> &
  Partial<
    Pick<
      FakeRunCaseRow,
      | 'recordedAt'
      | 'className'
      | 'filePath'
      | 'durationMs'
      | 'failureType'
      | 'failureMessage'
      | 'failureDetails'
      | 'skipReason'
    >
  >;

function project<T extends Record<string, unknown>>(
  row: T,
  select?: Record<string, unknown>,
): Partial<T> {
  if (select === undefined) return { ...row };

  const result: Partial<T> = {};
  for (const key of Object.keys(select)) {
    if (select[key] === true && key in row) {
      (result as Record<string, unknown>)[key] = row[key];
    }
  }
  return result;
}

function matches(
  row: Record<string, unknown>,
  where: Record<string, unknown> | undefined,
): boolean {
  if (where === undefined) return true;

  for (const [key, condition] of Object.entries(where)) {
    if (condition === undefined) continue;

    if (
      condition !== null &&
      typeof condition === 'object' &&
      'in' in (condition as Record<string, unknown>)
    ) {
      const list = (condition as { in: unknown[] }).in;
      if (!list.includes(row[key])) return false;
      continue;
    }

    if (row[key] !== condition) return false;
  }

  return true;
}

function createFakeDb() {
  let suiteSeq = 0;
  let caseSeq = 0;
  let runSeq = 0;
  let runCaseSeq = 0;

  const apiKeys = new Map<string, FakeApiKeyRow>();
  const suites = new Map<string, FakeSuiteRow>();
  const testCases = new Map<string, FakeTestCaseRow>();
  const runs = new Map<string, FakeRunRow>();
  const runCasesByRun = new Map<string, FakeRunCaseRow[]>();

  function runKey(runProjectId: string, source: string, externalId: string) {
    return `${runProjectId}:${source}:${externalId}`;
  }

  function findSuite(where: Record<string, unknown>): FakeSuiteRow | undefined {
    return [...suites.values()].find((row) =>
      matches(row as unknown as Record<string, unknown>, where),
    );
  }

  const suiteApi = {
    findFirst: jest.fn(
      ({
        where,
        select,
      }: {
        where: Record<string, unknown>;
        select?: Record<string, unknown>;
      }) => {
        const found = findSuite(where);
        return Promise.resolve(
          found === undefined
            ? null
            : project(found as unknown as Record<string, unknown>, select),
        );
      },
    ),
    create: jest.fn(
      ({
        data,
        select,
      }: {
        data: {
          projectId: string;
          organizationId: string;
          name: string;
          ingestionKey?: string;
        };
        select?: Record<string, unknown>;
      }) => {
        suiteSeq += 1;
        const row: FakeSuiteRow = {
          id: `suite-${suiteSeq}`,
          name: data.name,
          projectId: data.projectId,
          organizationId: data.organizationId,
          ingestionKey: data.ingestionKey ?? null,
        };
        suites.set(row.id, row);
        return Promise.resolve(
          project(row as unknown as Record<string, unknown>, select),
        );
      },
    ),
    findFirstOrThrow: jest.fn(
      (args: {
        where: Record<string, unknown>;
        select?: Record<string, unknown>;
      }) => {
        const found = findSuite(args.where);
        if (found === undefined) throw new Error('suite not found');
        return Promise.resolve(
          project(found as unknown as Record<string, unknown>, args.select),
        );
      },
    ),
    update: jest.fn(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = suites.get(where.id);
        if (row === undefined) throw new Error('suite not found');
        Object.assign(row, data);
        return Promise.resolve({ ...row });
      },
    ),
  };

  const testCaseApi = {
    findMany: jest.fn(
      ({
        where,
        select,
      }: {
        where: Record<string, unknown>;
        select?: Record<string, unknown>;
      }) =>
        Promise.resolve(
          [...testCases.values()]
            .filter((row) =>
              matches(row as unknown as Record<string, unknown>, where),
            )
            .map((row) =>
              project(row as unknown as Record<string, unknown>, select),
            ),
        ),
    ),
    createMany: jest.fn(
      ({
        data,
      }: {
        data: Array<{
          suiteId: string;
          projectId: string;
          name: string;
          state: string;
          executionMode: string;
          automationKey: string;
          automationClassName?: string;
          automationFilePath?: string;
        }>;
        skipDuplicates?: boolean;
      }) => {
        let count = 0;
        for (const entry of data) {
          const exists = [...testCases.values()].some(
            (row) => row.suiteId === entry.suiteId && row.name === entry.name,
          );
          if (exists) continue;

          caseSeq += 1;
          testCases.set(`case-${caseSeq}`, {
            id: `case-${caseSeq}`,
            suiteId: entry.suiteId,
            projectId: entry.projectId,
            name: entry.name,
            state: entry.state,
            executionMode: entry.executionMode,
            automationKey: entry.automationKey,
            automationClassName: entry.automationClassName ?? null,
            automationFilePath: entry.automationFilePath ?? null,
          });
          count += 1;
        }
        return Promise.resolve({ count });
      },
    ),
    update: jest.fn(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = testCases.get(where.id);
        if (row === undefined) throw new Error('test case not found');
        Object.assign(row, data);
        return Promise.resolve({ ...row });
      },
    ),
  };

  const runApi = {
    upsert: jest.fn(
      ({
        where,
        create,
        update,
        select,
      }: {
        where: {
          projectId_source_externalId: {
            projectId: string;
            source: string;
            externalId: string;
          };
        };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
        select?: Record<string, unknown>;
      }) => {
        const key = runKey(
          where.projectId_source_externalId.projectId,
          where.projectId_source_externalId.source,
          where.projectId_source_externalId.externalId,
        );
        const existing = runs.get(key);

        if (existing === undefined) {
          runSeq += 1;
          const row = {
            id: `run-${runSeq}`,
            finishedAt: null,
            executedById: null,
            commitSha: null,
            commitMessage: null,
            commitAuthor: null,
            ...create,
          } as FakeRunRow;
          runs.set(key, row);
          return Promise.resolve(
            project(row as unknown as Record<string, unknown>, select),
          );
        }

        Object.assign(existing, update);
        return Promise.resolve(
          project(existing as unknown as Record<string, unknown>, select),
        );
      },
    ),
  };

  const runCaseApi = {
    deleteMany: jest.fn(({ where }: { where: { runId: string } }) => {
      const existing = runCasesByRun.get(where.runId) ?? [];
      runCasesByRun.set(where.runId, []);
      return Promise.resolve({ count: existing.length });
    }),
    createManyAndReturn: jest.fn(
      ({
        data,
        select,
      }: {
        data: FakeRunCaseInput[];
        select?: Record<string, unknown>;
      }) => {
        const created: FakeRunCaseRow[] = data.map((entry) => {
          runCaseSeq += 1;
          const row: FakeRunCaseRow = {
            id: `run-case-${runCaseSeq}`,
            runId: entry.runId,
            testCaseId: entry.testCaseId,
            name: entry.name,
            suiteName: entry.suiteName,
            steps: entry.steps,
            expectedResult: entry.expectedResult,
            status: entry.status,
            position: entry.position,
            recordedAt: entry.recordedAt ?? null,
            className: entry.className ?? null,
            filePath: entry.filePath ?? null,
            durationMs: entry.durationMs ?? null,
            failureType: entry.failureType ?? null,
            failureMessage: entry.failureMessage ?? null,
            failureDetails: entry.failureDetails ?? null,
            skipReason: entry.skipReason ?? null,
          };
          return row;
        });

        const runId = created[0]?.runId;
        if (runId !== undefined) {
          const previous = runCasesByRun.get(runId) ?? [];
          runCasesByRun.set(runId, [...previous, ...created]);
        }

        return Promise.resolve(
          created.map((row) =>
            project(row as unknown as Record<string, unknown>, select),
          ),
        );
      },
    ),
    findMany: jest.fn(
      ({
        where,
        select,
        orderBy,
      }: {
        where: { runId: string };
        select?: Record<string, unknown>;
        orderBy?: { position: 'asc' | 'desc' };
      }) => {
        const rows = [...(runCasesByRun.get(where.runId) ?? [])];
        if (orderBy?.position === 'asc')
          rows.sort((a, b) => a.position - b.position);
        return Promise.resolve(
          rows.map((row) =>
            project(row as unknown as Record<string, unknown>, select),
          ),
        );
      },
    ),
  };

  const apiKeyApi = {
    findUnique: jest.fn(({ where }: { where: { lookupId: string } }) =>
      Promise.resolve(apiKeys.get(where.lookupId) ?? null),
    ),
    update: jest.fn(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = [...apiKeys.values()].find(
          (entry) => entry.id === where.id,
        );
        if (row === undefined) throw new Error('api key not found');
        Object.assign(row, data);
        return Promise.resolve({ ...row });
      },
    ),
  };

  const caseIdentityCollisionApi = {
    upsert: jest.fn(() => Promise.resolve({})),
    updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
  };

  const tx = {
    suite: suiteApi,
    testCase: testCaseApi,
    run: runApi,
    runCase: runCaseApi,
    caseIdentityCollision: caseIdentityCollisionApi,
  };
  type Tx = typeof tx;

  const prisma = {
    apiKey: apiKeyApi,
    suite: suiteApi,
    testCase: testCaseApi,
    run: runApi,
    runCase: runCaseApi,
    caseIdentityCollision: caseIdentityCollisionApi,
    $transaction: jest.fn((fn: (transaction: Tx) => unknown) => fn(tx)),
    seedApiKey(row: FakeApiKeyRow) {
      apiKeys.set(row.lookupId, row);
    },
    allSuites: () => [...suites.values()],
    allTestCases: () => [...testCases.values()],
    allRuns: () => [...runs.values()],
    testCasesBySuite: (suiteId: string) =>
      [...testCases.values()].filter((row) => row.suiteId === suiteId),
  };

  return prisma;
}

function createFakeReportBatchRedis() {
  const store = new Map<string, Map<string, string>>();

  return {
    recordReportSuiteResult: jest.fn(
      (
        key: string,
        size: string,
        recordOrganizationId: string,
        recordProjectId: string,
        reportExternalId: string,
        field: string,
        value: string,
      ) => {
        const hash = store.get(key) ?? new Map<string, string>();
        const created = !hash.has('size');
        if (created) {
          hash.set('size', size);
          hash.set('organizationId', recordOrganizationId);
          hash.set('projectId', recordProjectId);
          hash.set('reportExternalId', reportExternalId);
        }
        hash.set(field, value);
        store.set(key, hash);

        const resultCount = [...hash.keys()].filter((entryKey) =>
          entryKey.startsWith('result:'),
        ).length;
        const expectedSize = Number(hash.get('size'));

        if (resultCount < expectedSize) {
          return Promise.resolve(
            JSON.stringify({ complete: false, created: created ? 1 : 0 }),
          );
        }

        const data = Object.fromEntries(hash.entries());
        store.delete(key);
        return Promise.resolve(
          JSON.stringify({ complete: true, created: created ? 1 : 0, data }),
        );
      },
    ),
    flushReportBatch: jest.fn((key: string) => {
      const hash = store.get(key);
      if (hash === undefined)
        return Promise.resolve(JSON.stringify({ found: false }));
      const data = Object.fromEntries(hash.entries());
      store.delete(key);
      return Promise.resolve(JSON.stringify({ found: true, data }));
    }),
    quit: jest.fn().mockResolvedValue(undefined),
  };
}

function jobsFromCall(
  runIngestQueue: { addBulk: jest.Mock },
  callIndex: number,
): Array<{ data: RunIngestJobData }> {
  const [jobs] = runIngestQueue.addBulk.mock.calls[callIndex] as [
    Array<{ data: RunIngestJobData }>,
  ];
  return jobs;
}

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

describe('JUnit e2e fixture ingestion (e2e)', () => {
  let app: INestApplication<App>;
  const generated = generateApiKeyToken();
  const read = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    read.mockResolvedValue(session);

    const prisma = createFakeDb();
    prisma.seedApiKey({
      id: 'key-1',
      projectId,
      organizationId,
      lookupId: generated.lookupId,
      hashedSecret: hashApiKeySecret(generated.secret),
      revokedAt: null,
      lastUsedAt: null,
    });

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
      .overrideProvider(REPORT_BATCH_REDIS)
      .useValue(createFakeReportBatchRedis())
      .overrideProvider(AUTH_INSTANCE)
      .useValue({ handler: () => new Response('{}', { status: 200 }) })
      .overrideProvider(SESSION_READER)
      .useValue({ read })
      .overrideProvider(ENV)
      .useValue(testEnv)
      .compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    app.use(
      express.text({ type: ['application/xml', 'text/xml'], limit: '10mb' }),
    );
    app.useGlobalFilters(new AllExceptionsFilter(false));
    await app.init();

    (
      app as unknown as { fakePrisma: ReturnType<typeof createFakeDb> }
    ).fakePrisma = prisma;
  });

  afterEach(async () => {
    await app.close();
  });

  function getFakePrisma(): ReturnType<typeof createFakeDb> {
    return (app as unknown as { fakePrisma: ReturnType<typeof createFakeDb> })
      .fakePrisma;
  }

  function postFixture() {
    return request(app.getHttpServer())
      .post('/runs/ingest/junit?externalId=fixture-run-1&source=github_actions')
      .set('Authorization', `Bearer ${generated.token}`)
      .set('Content-Type', 'application/xml')
      .send(fixtureXml);
  }

  async function drain(callIndex: number) {
    const runIngestQueue = app.get<{ addBulk: jest.Mock }>(
      getQueueToken(RUN_INGEST_QUEUE),
    );
    const runsService = app.get(RunsService);
    const jobs = jobsFromCall(runIngestQueue, callIndex);

    const results: RunView[] = [];
    for (const job of jobs) {
      const result = await runsService.ingest(
        job.data.apiKey,
        job.data.body,
        job.data.reportSize,
      );
      if (isErr(result)) {
        throw new Error(`ingest failed for job: ${result.error}`);
      }
      results.push(result.value);
    }
    return results;
  }

  it('accepts one job per <testsuite> group in the fixture', async () => {
    const report = parseJunitXml(fixtureXml);
    const groups = groupJunitReportBySuite(report, 'fixture-run-1');

    const response = await postFixture().expect(202);

    expect((response.body as { accepted: number }).accepted).toBe(
      groups.length,
    );
    expect((response.body as { runs: unknown[] }).runs).toHaveLength(
      groups.length,
    );
  });

  it('creates exactly one suite per distinct testsuite name and one official case per <testcase>', async () => {
    const report = parseJunitXml(fixtureXml);
    const groups = groupJunitReportBySuite(report, 'fixture-run-1');

    await postFixture().expect(202);
    await drain(0);

    const prisma = getFakePrisma();

    expect(prisma.allSuites()).toHaveLength(groups.length);
    expect(prisma.allTestCases()).toHaveLength(report.cases.length);
  });

  it('gives every created case an automationFilePath under apps/api/test/ and an automationKey equal to its reported name', async () => {
    const report = parseJunitXml(fixtureXml);

    await postFixture().expect(202);
    await drain(0);

    const prisma = getFakePrisma();
    const reportedNames = new Set(
      report.cases.map((testCase) => testCase.name),
    );

    for (const testCase of prisma.allTestCases()) {
      expect(testCase.automationFilePath).not.toBeNull();
      expect(testCase.automationFilePath?.startsWith('apps/api/test/')).toBe(
        true,
      );
      expect(testCase.automationKey).not.toBeNull();
      expect(reportedNames.has(testCase.automationKey as string)).toBe(true);
    }
  });

  it('never collapses two cases into the same automation key within a suite', async () => {
    const report = parseJunitXml(fixtureXml);

    await postFixture().expect(202);
    await drain(0);

    const prisma = getFakePrisma();
    const keys = prisma
      .allTestCases()
      .map((testCase) => `${testCase.suiteId}:${testCase.automationKey}`);

    expect(new Set(keys).size).toBe(report.cases.length);
    expect(keys).toHaveLength(report.cases.length);
  });

  it('replays the same report idempotently: same runs updated, no new cases created', async () => {
    await postFixture().expect(202);
    const firstRuns = await drain(0);

    const prisma = getFakePrisma();
    const caseCountAfterFirst = prisma.allTestCases().length;
    const runCountAfterFirst = prisma.allRuns().length;
    const suiteCountAfterFirst = prisma.allSuites().length;

    await postFixture().expect(202);
    const secondRuns = await drain(1);

    expect(prisma.allTestCases()).toHaveLength(caseCountAfterFirst);
    expect(prisma.allRuns()).toHaveLength(runCountAfterFirst);
    expect(prisma.allSuites()).toHaveLength(suiteCountAfterFirst);

    const firstIds = firstRuns.map((run) => run.id).sort();
    const secondIds = secondRuns.map((run) => run.id).sort();
    expect(secondIds).toEqual(firstIds);
  });
});
