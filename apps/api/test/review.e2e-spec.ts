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
    },
    suite: { findFirst: jest.fn() },
    testCase: { create: jest.fn(), update: jest.fn() },
    testCaseVersion: { count: jest.fn(), create: jest.fn() },
    reviewDecision: { create: jest.fn() },
    traceabilityLink: { findMany: jest.fn(), createMany: jest.fn() },
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
    prisma.suite.findFirst.mockResolvedValue({ id: 'suite-1' });
    prisma.testCase.create.mockResolvedValue({ id: 'case-new' });
    prisma.testCase.update.mockResolvedValue({ id: 'case-new' });
    prisma.testCaseVersion.count.mockResolvedValue(0);
    prisma.testCaseVersion.create.mockResolvedValue({
      id: 'version-1',
      version: 1,
    });
    prisma.reviewDecision.create.mockResolvedValue({ id: 'decision-1' });
    prisma.traceabilityLink.findMany.mockResolvedValue([]);
    prisma.traceabilityLink.createMany.mockResolvedValue({ count: 2 });

    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule,
        PrismaModule,
        AuthModule,
        OrganizationsModule,
        ReviewModule,
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

  it('refuses the review routes without a session', async () => {
    read.mockResolvedValue(null);

    await request(app.getHttpServer()).get('/review/proposals').expect(401);
  });

  it('lists the proposals of the caller organization', async () => {
    const response = await request(app.getHttpServer())
      .get('/review/proposals')
      .expect(200);

    const body = response.body as { id: string; evidenceId: string }[];
    expect(body).toHaveLength(1);
    expect(body[0].evidenceId).toBe('evidence-1');
  });

  it('rejects an unknown status filter', async () => {
    await request(app.getHttpServer())
      .get('/review/proposals?status=whatever')
      .expect(400);
  });

  it('returns the proposal detail with evidence in the frontend contract shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/review/proposals/proposal-1')
      .expect(200);

    const body = response.body as { evidence: { kind: string } };
    expect(body.evidence.kind).toBe('source_excerpt');
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

  it('answers 409 when the proposal was already decided', async () => {
    prisma.extractedProposal.findFirst.mockResolvedValue({
      ...proposalRow,
      status: 'approved',
    });

    await request(app.getHttpServer())
      .post('/review/proposals/proposal-1/approve')
      .send({})
      .expect(409);
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

  it('records a rejection without publishing an official case', async () => {
    await request(app.getHttpServer())
      .post('/review/proposals/proposal-1/reject')
      .send({ comment: 'The steps do not match the evidence' })
      .expect(201);

    expect(prisma.testCase.create).not.toHaveBeenCalled();
    expect(prisma.testCaseVersion.create).not.toHaveBeenCalled();
  });
});
