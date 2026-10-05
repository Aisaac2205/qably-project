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
      groupBy: jest.fn().mockResolvedValue([]),
    },
    ciRun: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'ci-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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

  describe('updateCiRunIfUnchanged', () => {
    const readValues = {
      id: 'ci-1',
      startedAt: new Date('2026-09-01T10:30:00.000Z'),
      lastReportedAt: new Date('2026-09-01T10:31:00.000Z'),
      commitSha: null,
      commitMessage: 'fix: retry the checkout call',
      commitAuthor: null,
    };
    const patch = {
      startedAt: new Date('2026-09-01T10:05:00.000Z'),
      commitSha: 'a41f9c2',
    };

    it('writes the patch only to the row that still holds every value that was read', async () => {
      const { port, prisma } = build();
      prisma.ciRun.updateMany.mockResolvedValueOnce({ count: 1 });

      await expect(
        port.updateCiRunIfUnchanged(readValues, patch),
      ).resolves.toBe(true);
      expect(prisma.ciRun.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.ciRun.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'ci-1',
          startedAt: readValues.startedAt,
          lastReportedAt: readValues.lastReportedAt,
          commitSha: null,
          commitMessage: 'fix: retry the checkout call',
          commitAuthor: null,
        },
        data: patch,
      });
    });

    it('reports a lost race when no row matched the values that were read', async () => {
      const { port, prisma } = build();
      prisma.ciRun.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        port.updateCiRunIfUnchanged(readValues, patch),
      ).resolves.toBe(false);
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

  describe('job keys', () => {
    it('reads the distinct job keys a project already uses and drops the null group', async () => {
      const { port, prisma } = build();
      prisma.run.groupBy.mockResolvedValueOnce([
        { ciJobKey: 'api' },
        { ciJobKey: null },
        { ciJobKey: 'web' },
      ]);

      const keys = await port.readKnownJobKeys('proj-1');

      expect(keys).toEqual(['api', 'web']);
      expect(prisma.run.groupBy).toHaveBeenCalledWith({
        by: ['ciJobKey'],
        where: { projectId: 'proj-1', ciJobKey: { not: null } },
      });
    });

    it('reads the first page of linked runs without a job key in id order, with the run id of their CiRun', async () => {
      const { port, prisma } = build();
      prisma.run.findMany.mockResolvedValueOnce([
        {
          id: 'r1',
          projectId: 'proj-1',
          externalId: 'gha-900-api-junit-xml-ab12cd34',
          ciRun: { externalId: '900' },
        },
      ]);

      const rows = await port.readRunsMissingJobKey(undefined, 500);

      expect(rows).toEqual([
        {
          id: 'r1',
          projectId: 'proj-1',
          externalId: 'gha-900-api-junit-xml-ab12cd34',
          ciRunExternalId: '900',
        },
      ]);
      expect(prisma.run.findMany).toHaveBeenCalledWith({
        where: {
          ciRunId: { not: null },
          ciJobKey: null,
          externalId: { startsWith: 'gha-' },
        },
        orderBy: { id: 'asc' },
        take: 500,
        select: {
          id: true,
          projectId: true,
          externalId: true,
          ciRun: { select: { externalId: true } },
        },
      });
    });

    it('continues after the last id of the previous page and drops a row whose CiRun is gone', async () => {
      const { port, prisma } = build();
      prisma.run.findMany.mockResolvedValueOnce([
        { id: 'r10', projectId: 'proj-1', externalId: 'gha-1-a', ciRun: null },
      ]);

      const rows = await port.readRunsMissingJobKey('r9', 25);

      expect(rows).toEqual([]);
      expect(prisma.run.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            ciRunId: { not: null },
            ciJobKey: null,
            externalId: { startsWith: 'gha-' },
            id: { gt: 'r9' },
          },
          take: 25,
        }),
      );
    });

    it('writes the key only to runs that are linked and still have none, and returns the count', async () => {
      const { port, prisma } = build();
      prisma.run.updateMany.mockResolvedValueOnce({ count: 2 });

      const changed = await port.setJobKey(['r1', 'r2', 'r3'], 'api');

      expect(changed).toBe(2);
      expect(prisma.run.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['r1', 'r2', 'r3'] },
          ciJobKey: null,
          ciRunId: { not: null },
        },
        data: { ciJobKey: 'api' },
      });
    });
  });
});
