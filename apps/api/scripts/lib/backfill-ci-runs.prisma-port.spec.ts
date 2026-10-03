import { createPrismaBackfillPort } from './backfill-ci-runs.prisma-port';

const key = {
  projectId: 'proj-1',
  source: 'github_actions',
  externalId: '900',
} as const;

function build() {
  const prisma = {
    run: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
    ciRun: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'ci-1' }),
      update: jest.fn().mockResolvedValue({ id: 'ci-1' }),
    },
  };

  return { port: createPrismaBackfillPort(prisma as never), prisma };
}

describe('createPrismaBackfillPort', () => {
  const runSelect = {
    id: true,
    projectId: true,
    organizationId: true,
    source: true,
    externalId: true,
    startedAt: true,
    commitSha: true,
    commitMessage: true,
    commitAuthor: true,
  };

  it('reads the first page of unlinked runs in id order', async () => {
    const { port, prisma } = build();
    prisma.run.findMany.mockResolvedValueOnce([{ id: 'r1' }]);

    const rows = await port.readUnlinkedRuns(undefined, 500);

    expect(rows).toEqual([{ id: 'r1' }]);
    expect(prisma.run.findMany).toHaveBeenCalledWith({
      where: { ciRunId: null },
      orderBy: { id: 'asc' },
      take: 500,
      select: runSelect,
    });
  });

  it('continues after the last id of the previous page', async () => {
    const { port, prisma } = build();

    await port.readUnlinkedRuns('r9', 25);

    expect(prisma.run.findMany).toHaveBeenCalledWith({
      where: { ciRunId: null, id: { gt: 'r9' } },
      orderBy: { id: 'asc' },
      take: 25,
      select: runSelect,
    });
  });

  it('finds a CiRun by its unique key and returns null when absent', async () => {
    const { port, prisma } = build();
    const stored = { id: 'ci-1', commitSha: null };
    prisma.ciRun.findUnique.mockResolvedValueOnce(stored);

    expect(await port.findCiRun(key)).toBe(stored);
    expect(await port.findCiRun(key)).toBeNull();
    expect(prisma.ciRun.findUnique).toHaveBeenCalledWith({
      where: { projectId_source_externalId: key },
      select: {
        id: true,
        startedAt: true,
        lastReportedAt: true,
        commitSha: true,
        commitMessage: true,
        commitAuthor: true,
      },
    });
  });

  it('creates a CiRun and returns only its id', async () => {
    const { port, prisma } = build();
    const input = {
      ...key,
      organizationId: 'org-1',
      startedAt: new Date('2026-09-01T10:00:00.000Z'),
      lastReportedAt: new Date('2026-09-01T10:20:00.000Z'),
    };

    expect(await port.createCiRun(input)).toBe('ci-1');
    expect(prisma.ciRun.create).toHaveBeenCalledWith({
      data: input,
      select: { id: true },
    });
  });

  it('updates a CiRun by id with exactly the patch', async () => {
    const { port, prisma } = build();
    const patch = { commitSha: 'a41f9c2' };

    await expect(port.updateCiRun('ci-1', patch)).resolves.toBeUndefined();
    expect(prisma.ciRun.update).toHaveBeenCalledWith({
      where: { id: 'ci-1' },
      data: patch,
    });
  });

  it('links only runs that are still unlinked, writes nothing but ciRunId and returns the count', async () => {
    const { port, prisma } = build();

    const linked = await port.linkRuns('ci-1', ['r1', 'r2', 'r3']);

    expect(linked).toBe(3);
    expect(prisma.run.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['r1', 'r2', 'r3'] }, ciRunId: null },
      data: { ciRunId: 'ci-1' },
    });
  });
});
