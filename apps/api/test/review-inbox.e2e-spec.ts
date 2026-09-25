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
  automationKey: null,
  createdAt: new Date('2026-09-24T10:00:00.000Z'),
  locale: null,
  observations: null,
  suite: null,
  duplicateKind: null,
  matchedCaseId: null,
  matchedCase: null,
  duplicateScore: null,
  duplicateReasons: null,
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

describe('Review inbox (e2e)', () => {
  let app: INestApplication<App>;
  const read = jest.fn();
  const prisma = {
    orgMember: { findFirst: jest.fn() },
    organization: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
    extractedProposal: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    testCase: { findMany: jest.fn() },
    caseIdentityCollision: { count: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    read.mockResolvedValue(session);
    prisma.orgMember.findFirst.mockResolvedValue({
      organizationId: 'org-1',
      role: 'owner',
      organization: { slug: 'acme' },
    });
    prisma.extractedProposal.findMany.mockResolvedValue([proposalRow]);
    prisma.extractedProposal.groupBy.mockResolvedValue([
      {
        status: 'in_review',
        _count: { _all: 1 },
        _max: { updatedAt: new Date('2026-09-24T10:00:00.000Z') },
      },
    ]);
    prisma.testCase.findMany.mockResolvedValue([]);
    prisma.caseIdentityCollision.count.mockResolvedValue(0);

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

  it('refuses the inbox routes without a session', async () => {
    read.mockResolvedValue(null);

    await request(app.getHttpServer()).get('/review/inbox').expect(401);
  });

  it('defaults status to in_review and returns a page with items', async () => {
    const response = await request(app.getHttpServer())
      .get('/review/inbox')
      .expect(200);

    const body = response.body as {
      items: { id: string }[];
      nextCursor: string | null;
    };
    expect(body.items).toHaveLength(1);
    expect(body.nextCursor).toBeNull();

    const [call] = prisma.extractedProposal.findMany.mock.calls as [
      [{ where: { status?: string } }],
    ];
    expect(call[0].where.status).toBe('in_review');
  });

  it('omits the status filter when status=all is requested', async () => {
    await request(app.getHttpServer())
      .get('/review/inbox?status=all')
      .expect(200);

    const [call] = prisma.extractedProposal.findMany.mock.calls as [
      [{ where: { status?: string } }],
    ];
    expect(call[0].where.status).toBeUndefined();
  });

  it('rejects an unknown status filter', async () => {
    await request(app.getHttpServer())
      .get('/review/inbox?status=whatever')
      .expect(400);
  });

  it('rejects a malformed cursor', async () => {
    await request(app.getHttpServer())
      .get('/review/inbox?cursor=not-a-cursor')
      .expect(400);
  });

  it('rejects a limit above 100', async () => {
    await request(app.getHttpServer())
      .get('/review/inbox?limit=101')
      .expect(400);
  });

  it('returns the status counts shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/review/inbox/counts')
      .expect(200);

    const body = response.body as {
      byStatus: Record<string, number>;
      version: string;
    };
    expect(body.byStatus).toEqual({
      in_review: 1,
      approved: 0,
      rejected: 0,
      changes_requested: 0,
    });
    expect(typeof body.version).toBe('string');
    expect(body.version.length).toBeGreaterThan(0);
  });
});
