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

const suiteProposalRow = {
  id: 'suite-proposal-1',
  projectId: 'project-1',
  suiteId: 'suite-1',
  title: 'Cart suite',
  description: 'Covers the shopping cart',
  status: 'in_review',
  evidenceId: 'evidence-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  decidedAt: null,
  locale: null,
  suite: { name: 'Cart suite', nameSource: 'ingestion' },
};

describe('SuiteProposals (e2e)', () => {
  let app: INestApplication<App>;
  const read = jest.fn();
  const prisma = {
    orgMember: { findFirst: jest.fn() },
    organization: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
    suiteProposal: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    suite: { update: jest.fn() },
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
    prisma.suiteProposal.findMany.mockResolvedValue([suiteProposalRow]);
    prisma.suiteProposal.findFirst.mockResolvedValue(suiteProposalRow);
    prisma.suiteProposal.update.mockResolvedValue({ id: 'suite-proposal-1' });
    prisma.suite.update.mockResolvedValue({ name: 'Cart suite' });

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

  it('lists suite proposals at /review/suite-proposals, the exact path the web client calls', async () => {
    const response = await request(app.getHttpServer())
      .get('/review/suite-proposals')
      .expect(200);

    const body = response.body as { id: string }[];
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('suite-proposal-1');
  });

  it('approves a suite proposal at /review/suite-proposals/:id/approve', async () => {
    await request(app.getHttpServer())
      .post('/review/suite-proposals/suite-proposal-1/approve')
      .send({})
      .expect(201);
  });

  it('rejects a suite proposal at /review/suite-proposals/:id/reject', async () => {
    await request(app.getHttpServer())
      .post('/review/suite-proposals/suite-proposal-1/reject')
      .send({})
      .expect(201);
  });

  it('refuses suite-proposal routes without a session', async () => {
    read.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/review/suite-proposals')
      .expect(401);
  });
});
