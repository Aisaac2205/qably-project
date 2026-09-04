import { err, ok } from '../../common/result';
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

function createConnections() {
  return {
    rotateWebhookSecret: jest
      .fn()
      .mockResolvedValue(ok({ webhookSecret: 'f'.repeat(64) })),
  };
}

function build(
  prisma: FakePrisma,
  connections: ReturnType<typeof createConnections> = createConnections(),
): RepositoryService {
  return new RepositoryService(prisma as never, connections as never);
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

describe('RepositoryService.rotateWebhookSecret', () => {
  it('rotates the secret of the connection behind the project', async () => {
    const connections = createConnections();
    const prisma = createPrisma({ connectionId: 'connection-1' });

    const result = await build(prisma, connections).rotateWebhookSecret(
      org,
      'proj-1',
    );

    expect(result).toEqual({
      ok: true,
      value: { webhookSecret: 'f'.repeat(64) },
    });
    expect(connections.rotateWebhookSecret).toHaveBeenCalledWith(
      org,
      'connection-1',
    );
  });

  it('scopes the project lookup to the acting organization', async () => {
    const prisma = createPrisma({ connectionId: 'connection-1' });

    await build(prisma).rotateWebhookSecret(org, 'proj-1');

    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'proj-1', organizationId: 'org-1' },
      }),
    );
  });

  it('fails when the project does not belong to the organization', async () => {
    const connections = createConnections();

    const result = await build(
      createPrisma(null),
      connections,
    ).rotateWebhookSecret(org, 'proj-1');

    expect(result).toEqual({ ok: false, error: 'not-found' });
    expect(connections.rotateWebhookSecret).not.toHaveBeenCalled();
  });

  it('fails when the project has no repository connected', async () => {
    const connections = createConnections();

    const result = await build(
      createPrisma({ connectionId: null }),
      connections,
    ).rotateWebhookSecret(org, 'proj-1');

    expect(result).toEqual({ ok: false, error: 'no-connection' });
    expect(connections.rotateWebhookSecret).not.toHaveBeenCalled();
  });

  it('propagates a role that cannot rotate', async () => {
    const connections = createConnections();
    connections.rotateWebhookSecret.mockResolvedValue(err('forbidden'));

    const result = await build(
      createPrisma({ connectionId: 'connection-1' }),
      connections,
    ).rotateWebhookSecret(org, 'proj-1');

    expect(result).toEqual({ ok: false, error: 'forbidden' });
  });
});
