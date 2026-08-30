import { RepositoryService } from './repository.service';

interface FakePrisma {
  project: { findFirst: jest.Mock };
  ingestionBatch: { findFirst: jest.Mock };
}

const org = { organizationId: 'org-1', role: 'OWNER' } as never;

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

function createPrisma(
  project: unknown = projectRow,
  batch: unknown = batchRow,
): FakePrisma {
  return {
    project: { findFirst: jest.fn().mockResolvedValue(project) },
    ingestionBatch: { findFirst: jest.fn().mockResolvedValue(batch) },
  };
}

function build(prisma: FakePrisma): RepositoryService {
  return new RepositoryService(prisma as never);
}

describe('RepositoryService.findOne', () => {
  it('fails when the project does not belong to the organization', async () => {
    const prisma = createPrisma(null);

    await expect(build(prisma).findOne(org, 'proj-1')).resolves.toEqual({
      ok: false,
      error: 'not-found',
    });
    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'proj-1', organizationId: 'org-1' },
      }),
    );
  });

  it('exposes the connected repository as the declared source', async () => {
    const result = await build(createPrisma()).findOne(org, 'proj-1');

    expect(result).toMatchObject({
      ok: true,
      value: {
        source: {
          provider: 'GITHUB',
          repo: 'acme/shop',
          testFilePatterns: ['*.spec.ts', '*.test.ts'],
        },
      },
    });
  });

  it('reports no source when the project has no connection', async () => {
    const result = await build(
      createPrisma({ ...projectRow, connection: null }),
    ).findOne(org, 'proj-1');

    expect(result).toMatchObject({ ok: true, value: { source: null } });
  });

  it('returns the latest batch with its code changes and evidence', async () => {
    const result = await build(createPrisma()).findOne(org, 'proj-1');

    expect(result).toEqual({
      ok: true,
      value: {
        source: {
          provider: 'GITHUB',
          repo: 'acme/shop',
          testFilePatterns: ['*.spec.ts', '*.test.ts'],
        },
        batch: {
          id: 'batch-1',
          projectId: 'proj-1',
          source: 'webhook',
          status: 'completed',
          codeChangeIds: ['change-1'],
          createdAt: '2026-08-30T00:00:00.000Z',
        },
        codeChanges: [
          {
            id: 'change-1',
            projectId: 'proj-1',
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
            projectId: 'proj-1',
            kind: 'source_excerpt',
            title: 'src/cart.spec.ts',
            uri: 'https://github.com/acme/shop/blob/aaa/src/cart.spec.ts',
            createdAt: '2026-08-30T00:00:00.000Z',
          },
        ],
      },
    });
  });

  it('reads the most recent batch for the project', async () => {
    const prisma = createPrisma();

    await build(prisma).findOne(org, 'proj-1');

    expect(prisma.ingestionBatch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'proj-1' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('returns an empty view when the project has never ingested a batch', async () => {
    const result = await build(createPrisma(projectRow, null)).findOne(
      org,
      'proj-1',
    );

    expect(result).toMatchObject({
      ok: true,
      value: { batch: null, codeChanges: [], evidence: [] },
    });
  });
});
