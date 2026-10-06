import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ConfigModule } from '../src/config/config.module';
import { ENV } from '../src/config/config.tokens';
import {
  SESSION_READER,
  type SessionContext,
} from '../src/modules/auth/auth.contracts';
import { AUTH_INSTANCE } from '../src/modules/auth/auth.instance';
import { AuthModule } from '../src/modules/auth/auth.module';
import { OrganizationsModule } from '../src/modules/organizations/organizations.module';
import { SuitesModule } from '../src/modules/suites/suites.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { countingUpdateMany } from './support/prisma-stub';
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

function summaryRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    projectId: 'project-1',
    name: `Suite ${id}`,
    description: '',
    tags: [] as string[],
    isDefault: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    _count: { cases: 0 },
    ...overrides,
  };
}

const suiteRow = {
  id: 'suite-1',
  projectId: 'project-1',
  organizationId: 'org-1',
  name: 'Checkout',
  description: '',
  tags: [],
  isDefault: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  cases: [
    {
      id: 'case-1',
      suiteId: 'suite-1',
      name: 'Adds to cart',
      steps: ['open', 'add'],
      expectedResult: 'cart has one item',
      priority: 'medium',
      state: 'active',
    },
  ],
};

interface PageBody {
  items: Record<string, unknown>[];
  nextCursor: string | null;
}

describe('Suite list (e2e)', () => {
  let app: INestApplication<App>;
  const read = jest.fn();
  const prisma = {
    orgMember: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    organization: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findUnique: jest.fn(),
    },
    project: { findFirst: jest.fn(), findUnique: jest.fn() },
    suite: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: countingUpdateMany(),
      delete: jest.fn(),
    },
    testCase: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: countingUpdateMany(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    extractedProposal: { findMany: jest.fn() },
    runCase: { findMany: jest.fn() },
    caseIdentityCollision: { groupBy: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    read.mockResolvedValue(session);
    prisma.caseIdentityCollision.groupBy.mockResolvedValue([]);
    prisma.orgMember.findFirst.mockResolvedValue({
      organizationId: 'org-1',
      role: 'owner',
      organization: { slug: 'acme' },
      user: { locale: 'en' },
    });
    prisma.suite.findMany.mockResolvedValue([]);
    prisma.suite.findFirst.mockResolvedValue(suiteRow);
    prisma.extractedProposal.findMany.mockResolvedValue([]);
    prisma.testCase.findMany.mockResolvedValue([]);
    prisma.testCase.count.mockResolvedValue(0);
    prisma.runCase.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.organization.findUnique.mockResolvedValue({
      plan: 'equipo',
      aiEnabled: true,
      aiCreditsUsed: 0,
      aiCreditsPeriodStart: new Date(),
    });

    const moduleFixture = await stubQueues(
      Test.createTestingModule({
        imports: [
          ConfigModule,
          PrismaModule,
          AuthModule,
          OrganizationsModule,
          SuitesModule,
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

  describe('GET /suites/summaries', () => {
    it('refuses the route without a session', async () => {
      read.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/suites/summaries')
        .query({ projectId: 'project-1' })
        .expect(401);
    });

    it('answers 403 when the organization header names a foreign organization', async () => {
      prisma.orgMember.findFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/suites/summaries')
        .query({ projectId: 'project-1' })
        .set('x-organization-id', 'org-someone-else')
        .expect(403);
    });

    it('answers a project of another organization with an empty page scoped to the caller', async () => {
      const response = await request(app.getHttpServer())
        .get('/suites/summaries')
        .query({ projectId: 'project-x' })
        .expect(200);

      expect(response.body).toEqual({ items: [], nextCursor: null });
      expect(prisma.suite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', projectId: 'project-x' },
        }),
      );
    });

    it('reaches the summaries handler and not the suite lookup by id', async () => {
      prisma.suite.findMany.mockResolvedValue([summaryRow('suite-1')]);

      const response = await request(app.getHttpServer())
        .get('/suites/summaries')
        .query({ projectId: 'project-1' })
        .expect(200);

      const body = response.body as PageBody;
      expect(Object.keys(body).sort()).toEqual(['items', 'nextCursor']);
      expect(body.items).toHaveLength(1);
      expect(prisma.suite.findFirst).not.toHaveBeenCalled();
    });

    it('rejects a request without a project instead of looking up a suite named summaries', async () => {
      const response = await request(app.getHttpServer())
        .get('/suites/summaries')
        .expect(400);

      const body = response.body as {
        message: string;
        issues: { path: string }[];
      };
      expect(body.message).toBe('Validation failed');
      expect(body.issues.map((issue) => issue.path)).toContain('projectId');
      expect(prisma.suite.findFirst).not.toHaveBeenCalled();
    });

    it('keeps GET /suites/:id on the suite lookup', async () => {
      const response = await request(app.getHttpServer())
        .get('/suites/suite-1')
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({ id: 'suite-1', name: 'Checkout' }),
      );
      expect(prisma.suite.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'suite-1', organizationId: 'org-1' },
        }),
      );
    });

    it('keeps GET /suites as the full list and ignores the paging parameters', async () => {
      prisma.suite.findMany.mockResolvedValue([
        suiteRow,
        { ...suiteRow, id: 'suite-2', name: 'Billing' },
      ]);

      const response = await request(app.getHttpServer())
        .get('/suites')
        .query({ projectId: 'project-1', limit: 1, cursor: 'x' })
        .expect(200);

      const body = response.body as { id: string; cases: unknown[] }[];
      expect(body.map((suite) => suite.id)).toEqual(['suite-1', 'suite-2']);
      expect(body[0].cases).toHaveLength(1);
    });
  });
});
