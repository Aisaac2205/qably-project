import { IngestionProcessor } from './ingestion.processor';

interface FakePrisma {
  scmEvent: { findUnique: jest.Mock; update: jest.Mock };
  ingestionBatch: { create: jest.Mock };
}

const defaultEvent = {
  id: 'event-1',
  provider: 'GITHUB',
  repo: 'acme/shop',
  commitSha: 'a'.repeat(40),
  changedFiles: ['src/cart.spec.ts', 'src/cart.ts'],
  connection: {
    projects: [{ id: 'proj-1', testFilePatterns: ['*.spec.ts', '*.test.ts'] }],
  },
};

function createPrisma(event: unknown = defaultEvent): FakePrisma {
  return {
    scmEvent: {
      findUnique: jest.fn().mockResolvedValue(event),
      update: jest.fn().mockResolvedValue({}),
    },
    ingestionBatch: { create: jest.fn().mockResolvedValue({}) },
  };
}

interface BatchCreateArgument {
  data: {
    project: { connect: { id: string } };
    scmEvent: { connect: { id: string } };
    source: string;
    status: string;
    codeChanges: {
      create: Array<{
        filePath: string;
        commitSha: string;
        detectedPattern: string | null;
        evidence: { create: Record<string, unknown> };
      }>;
    };
  };
}

function batchCalls(prisma: FakePrisma): BatchCreateArgument[] {
  return prisma.ingestionBatch.create.mock.calls.map(
    ([argument]: [BatchCreateArgument]) => argument,
  );
}

function job(scmEventId: string) {
  return { data: { scmEventId } } as never;
}

describe('IngestionProcessor', () => {
  it('marks the event processed once the job completes', async () => {
    const prisma = createPrisma();

    await new IngestionProcessor(prisma as never).process(job('event-1'));

    expect(prisma.scmEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { status: 'PROCESSED' },
    });
  });

  it('records one batch per project hanging off the connection', async () => {
    const prisma = createPrisma({
      ...defaultEvent,
      connection: {
        projects: [
          { id: 'proj-1', testFilePatterns: ['*.spec.ts'] },
          { id: 'proj-2', testFilePatterns: ['*.spec.ts'] },
        ],
      },
    });

    await new IngestionProcessor(prisma as never).process(job('event-1'));

    expect(prisma.ingestionBatch.create).toHaveBeenCalledTimes(2);
    expect(
      batchCalls(prisma).map((call) => call.data.project.connect.id),
    ).toEqual(['proj-1', 'proj-2']);
  });

  it('persists every changed file and flags only the ones matching a declared pattern', async () => {
    const prisma = createPrisma();

    await new IngestionProcessor(prisma as never).process(job('event-1'));

    const [{ data }] = batchCalls(prisma);

    expect(data.source).toBe('WEBHOOK');
    expect(data.status).toBe('COMPLETED');
    expect(data.scmEvent.connect.id).toBe('event-1');
    expect(data.codeChanges.create).toEqual([
      expect.objectContaining({
        filePath: 'src/cart.spec.ts',
        commitSha: 'a'.repeat(40),
        detectedPattern: '*.spec.ts',
      }),
      expect.objectContaining({
        filePath: 'src/cart.ts',
        detectedPattern: null,
      }),
    ]);
  });

  it('attaches source evidence pointing at the file on the pushed commit', async () => {
    const prisma = createPrisma();

    await new IngestionProcessor(prisma as never).process(job('event-1'));

    const [{ data }] = batchCalls(prisma);

    expect(data.codeChanges.create[0].evidence.create).toEqual({
      project: { connect: { id: 'proj-1' } },
      kind: 'SOURCE_EXCERPT',
      title: 'src/cart.spec.ts',
      uri: `https://github.com/acme/shop/blob/${'a'.repeat(40)}/src/cart.spec.ts`,
    });
  });

  it('records no batch when the event carries no changed files', async () => {
    const prisma = createPrisma({ ...defaultEvent, changedFiles: [] });

    await new IngestionProcessor(prisma as never).process(job('event-1'));

    expect(prisma.ingestionBatch.create).not.toHaveBeenCalled();
    expect(prisma.scmEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { status: 'PROCESSED' },
    });
  });

  it('records no batch when no project hangs off the connection', async () => {
    const prisma = createPrisma({
      ...defaultEvent,
      connection: { projects: [] },
    });

    await new IngestionProcessor(prisma as never).process(job('event-1'));

    expect(prisma.ingestionBatch.create).not.toHaveBeenCalled();
  });

  it('marks the event failed and rethrows when processing breaks', async () => {
    const prisma = createPrisma();
    const failure = new Error('downstream unavailable');
    prisma.ingestionBatch.create.mockRejectedValueOnce(failure);

    await expect(
      new IngestionProcessor(prisma as never).process(job('event-2')),
    ).rejects.toThrow(failure);

    expect(prisma.scmEvent.update).toHaveBeenLastCalledWith({
      where: { id: 'event-2' },
      data: { status: 'FAILED' },
    });
  });
});
