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
import { ReviewModule } from '../src/modules/review/review.module';
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

const proposalRow = {
  id: 'proposal-1',
  projectId: 'project-1',
  status: 'in_review',
  title: 'Empties the cart',
  objective: 'Confirm the cart resets',
  preconditions: ['A signed-in user'],
  steps: ['Open the cart'],
  expectedResult: 'The cart shows zero items',
  priority: 'high',
  evidenceId: 'evidence-1',
  targetTestCaseId: null,
  targetTestCase: null,
  codeChange: null,
  duplicateKind: null,
  matchedCaseId: null,
  matchedCase: null,
  evidence: {
    id: 'evidence-1',
    projectId: 'project-1',
    kind: 'SOURCE_EXCERPT',
    title: 'cart.spec.ts',
    uri: 'https://example.test/cart.spec.ts',
    excerpt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  },
};

describe('Review (e2e)', () => {
  let app: INestApplication<App>;
  const read = jest.fn();
  const prisma = {
    orgMember: { findFirst: jest.fn() },
    organization: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
    extractedProposal: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    suite: { findFirst: jest.fn() },
    testCase: { create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    testCaseVersion: { count: jest.fn(), create: jest.fn() },
    reviewDecision: { create: jest.fn(), findFirst: jest.fn() },
    traceabilityLink: { findMany: jest.fn(), createMany: jest.fn() },
    runCase: { findMany: jest.fn() },
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
    prisma.extractedProposal.findMany.mockResolvedValue([proposalRow]);
    prisma.extractedProposal.findFirst.mockResolvedValue(proposalRow);
    prisma.extractedProposal.update.mockResolvedValue({ id: 'proposal-1' });
    prisma.extractedProposal.updateMany.mockResolvedValue({ count: 1 });
    prisma.suite.findFirst.mockResolvedValue({ id: 'suite-1' });
    prisma.testCase.create.mockResolvedValue({ id: 'case-new' });
    prisma.testCase.update.mockResolvedValue({ id: 'case-new' });
    prisma.testCase.findMany.mockResolvedValue([]);
    prisma.testCaseVersion.count.mockResolvedValue(0);
    prisma.testCaseVersion.create.mockResolvedValue({
      id: 'version-1',
      version: 1,
    });
    prisma.reviewDecision.create.mockResolvedValue({ id: 'decision-1' });
    prisma.reviewDecision.findFirst.mockResolvedValue(null);
    prisma.traceabilityLink.findMany.mockResolvedValue([]);
    prisma.traceabilityLink.createMany.mockResolvedValue({ count: 2 });
    prisma.runCase.findMany.mockResolvedValue([]);

    const moduleFixture = await stubQueues(
      Test.createTestingModule({
        imports: [
          ConfigModule,
          PrismaModule,
          AuthModule,
          OrganizationsModule,
          ReviewModule,
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

  it('refuses the review routes without a session', async () => {
    read.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/review/proposals/proposal-1')
      .expect(401);
  });

  it('returns the proposal detail with evidence in the frontend contract shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/review/proposals/proposal-1')
      .expect(200);

    const body = response.body as { evidence: { kind: string } };
    expect(body.evidence.kind).toBe('source_excerpt');
  });

  it('returns matchedCase, publishedVersion, source and recentRuns for a targeted proposal', async () => {
    prisma.extractedProposal.findFirst.mockResolvedValue({
      ...proposalRow,
      targetTestCaseId: 'case-9',
      targetTestCase: {
        id: 'case-9',
        name: 'Empties the cart',
        suiteId: 'suite-9',
        suite: { name: 'Cart suite' },
        currentVersion: {
          version: 2,
          title: 'Empties the cart',
          objective: 'Confirm the cart resets',
          preconditions: [],
          steps: ['Open the cart', 'Remove every item'],
          expectedResult: 'The cart shows zero items',
          publishedAt: new Date('2026-02-01T10:00:00.000Z'),
        },
      },
      codeChange: {
        filePath: 'src/cart.ts',
        commitSha: 'abc123',
        pullRequestNumber: 42,
      },
    });
    prisma.reviewDecision.findFirst.mockImplementation(
      (args: { where: { proposalId?: string } }) =>
        Promise.resolve(
          args.where.proposalId === undefined
            ? { actor: { id: 'user-2', name: 'Grace Hopper' } }
            : null,
        ),
    );
    prisma.runCase.findMany.mockResolvedValue([
      {
        runId: 'run-1',
        status: 'pass',
        recordedAt: new Date('2026-02-05T00:00:00.000Z'),
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/review/proposals/proposal-1')
      .expect(200);

    const body = response.body as {
      matchedCase: {
        id: string;
        name: string;
        suiteId: string;
        suiteName: string;
      };
      publishedVersion: {
        version: number;
        publishedBy: { name: string } | null;
      };
      source: {
        filePath: string;
        commitSha: string | null;
        pullRequestNumber: number | null;
      };
      recentRuns: { runId: string; status: string }[];
      decision: unknown;
    };
    expect(body.matchedCase).toEqual({
      id: 'case-9',
      name: 'Empties the cart',
      suiteId: 'suite-9',
      suiteName: 'Cart suite',
    });
    expect(body.publishedVersion?.version).toBe(2);
    expect(body.publishedVersion?.publishedBy).toEqual({
      id: 'user-2',
      name: 'Grace Hopper',
    });
    expect(body.source).toEqual({
      filePath: 'src/cart.ts',
      uri: 'https://example.test/cart.spec.ts',
      commitSha: 'abc123',
      pullRequestNumber: 42,
    });
    expect(body.recentRuns).toEqual([
      {
        runId: 'run-1',
        status: 'pass',
        recordedAt: '2026-02-05T00:00:00.000Z',
      },
    ]);
    expect(body.decision).toBeNull();
  });

  it('answers 404 for a proposal outside the resolved organization', async () => {
    prisma.extractedProposal.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/review/proposals/proposal-1')
      .expect(404);
  });

  it('publishes the official case when approving', async () => {
    const response = await request(app.getHttpServer())
      .post('/review/proposals/proposal-1/approve')
      .send({ comment: 'Matches the evidence' })
      .expect(201);

    expect(response.body).toEqual({
      createdNewCase: true,
      testCaseId: 'case-new',
      testCaseName: 'Empties the cart',
      suiteId: 'suite-1',
      versionId: 'version-1',
      version: 1,
      decisionId: 'decision-1',
    });
  });

  it('takes the actor from the session, never from the body', async () => {
    await request(app.getHttpServer())
      .post('/review/proposals/proposal-1/approve')
      .send({ actorId: 'someone-else' })
      .expect(201);

    const [call] = prisma.reviewDecision.create.mock.calls as [
      [{ data: { actorId: string } }],
    ];
    expect(call[0].data.actorId).toBe('user-1');
  });

  it('answers 409 with who decided, what, and when when the proposal was already decided', async () => {
    prisma.extractedProposal.findFirst.mockResolvedValue({
      ...proposalRow,
      status: 'approved',
    });
    prisma.reviewDecision.findFirst.mockResolvedValue({
      action: 'approved',
      decidedAt: new Date('2026-01-05T12:00:00.000Z'),
      actor: { id: 'user-2', name: 'Grace Hopper' },
    });

    const response = await request(app.getHttpServer())
      .post('/review/proposals/proposal-1/approve')
      .send({})
      .expect(409);

    expect(response.body).toMatchObject({
      code: 'invalid-transition',
      decision: {
        action: 'approved',
        decidedAt: '2026-01-05T12:00:00.000Z',
        decidedBy: { id: 'user-2', name: 'Grace Hopper' },
      },
    });
  });

  it('answers 409 with a null decision when the proposal was decided by something the audit trail lost', async () => {
    prisma.extractedProposal.findFirst.mockResolvedValue({
      ...proposalRow,
      status: 'approved',
    });
    prisma.reviewDecision.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post('/review/proposals/proposal-1/reject')
      .send({})
      .expect(409);

    expect(response.body).toMatchObject({
      code: 'invalid-transition',
      decision: null,
    });
  });

  it('answers 422 when the backing evidence is gone', async () => {
    prisma.extractedProposal.findFirst.mockResolvedValue({
      ...proposalRow,
      evidence: null,
    });

    await request(app.getHttpServer())
      .post('/review/proposals/proposal-1/approve')
      .send({})
      .expect(422);
  });

  it('answers 409 when the title collides with another case in the suite', async () => {
    prisma.testCase.create.mockRejectedValue({ code: 'P2002' });

    await request(app.getHttpServer())
      .post('/review/proposals/proposal-1/approve')
      .send({})
      .expect(409);
  });

  it('records a rejection without publishing an official case', async () => {
    await request(app.getHttpServer())
      .post('/review/proposals/proposal-1/reject')
      .send({ comment: 'The steps do not match the evidence' })
      .expect(201);

    expect(prisma.testCase.create).not.toHaveBeenCalled();
    expect(prisma.testCaseVersion.create).not.toHaveBeenCalled();
  });
});
