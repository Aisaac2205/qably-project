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
import { OrganizationsModule } from '../src/modules/organizations/organizations.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RepositoryModule } from '../src/modules/repository/repository.module';

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

const projectRow = {
  testFilePatterns: ['*.spec.ts', '*.test.ts'],
  connection: { provider: 'GITHUB', repo: 'acme/shop' },
};

const batchRow = {
  id: 'batch-1',
  source: 'WEBHOOK',
  status: 'COMPLETED',
  createdAt: new Date('2026-08-30T00:00:00.000Z'),
  codeChanges: [
    {
      id: 'change-1',
      pullRequestNumber: null,
      commitSha: 'a'.repeat(40),
      filePath: 'src/cart.spec.ts',
      diff: '',
      detectedPattern: '*.spec.ts',
      evidenceId: 'evidence-1',
      evidence: {
        id: 'evidence-1',
        kind: 'SOURCE_EXCERPT',
        title: 'src/cart.spec.ts',
        uri: 'https://github.com/acme/shop/blob/aaa/src/cart.spec.ts',
        excerpt: null,
        createdAt: new Date('2026-08-30T00:00:00.000Z'),
      },
    },
  ],
};

describe('Repository (e2e)', () => {
  let app: INestApplication<App>;
  const read = jest.fn();
  const prisma = {
    orgMember: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    organization: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
    project: { findFirst: jest.fn() },
    ingestionBatch: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    read.mockResolvedValue(session);
    prisma.orgMember.findFirst.mockResolvedValue({
      organizationId: 'org-1',
      role: 'owner',
      organization: { slug: 'acme' },
    });
    prisma.project.findFirst.mockResolvedValue(projectRow);
    prisma.ingestionBatch.findFirst.mockResolvedValue(batchRow);

    const moduleFixture = await Test.createTestingModule({
      imports: [
        PrismaModule,
        AuthModule,
        OrganizationsModule,
        RepositoryModule,
      ],
    })
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

  it('refuses the repository route without a session', async () => {
    read.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/projects/project-1/repository')
      .expect(401);
  });

  it('returns the source, the latest batch, its changes and evidence', async () => {
    const response = await request(app.getHttpServer())
      .get('/projects/project-1/repository')
      .expect(200);

    expect(response.body).toEqual({
      source: {
        provider: 'GITHUB',
        repo: 'acme/shop',
        testFilePatterns: ['*.spec.ts', '*.test.ts'],
      },
      batch: {
        id: 'batch-1',
        projectId: 'project-1',
        source: 'webhook',
        status: 'completed',
        codeChangeIds: ['change-1'],
        createdAt: '2026-08-30T00:00:00.000Z',
      },
      codeChanges: [
        {
          id: 'change-1',
          projectId: 'project-1',
          commitSha: 'a'.repeat(40),
          filePath: 'src/cart.spec.ts',
          diff: '',
          detectedPattern: '*.spec.ts',
          evidenceId: 'evidence-1',
        },
      ],
      evidence: [
        {
          id: 'evidence-1',
          projectId: 'project-1',
          kind: 'source_excerpt',
          title: 'src/cart.spec.ts',
          uri: 'https://github.com/acme/shop/blob/aaa/src/cart.spec.ts',
          createdAt: '2026-08-30T00:00:00.000Z',
        },
      ],
    });
    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'project-1', organizationId: 'org-1' },
      }),
    );
  });

  it('answers 404 for a project outside the resolved organization', async () => {
    prisma.project.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/projects/foreign/repository')
      .expect(404);
  });
});
