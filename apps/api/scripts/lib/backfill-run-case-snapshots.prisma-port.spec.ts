import { Prisma } from '../../generated/prisma/client';
import type { RunCaseCatalogSnapshot } from '../../src/modules/runs/lib/catalog-snapshot';
import { createPrismaSnapshotBackfillPort } from './backfill-run-case-snapshots.prisma-port';

function build() {
  const prisma = {
    runCase: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    testCaseVersion: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };

  return { port: createPrismaSnapshotBackfillPort(prisma as never), prisma };
}

describe('createPrismaSnapshotBackfillPort', () => {
  it('counts the run cases that already hold a snapshot of any shape', async () => {
    const { port, prisma } = build();
    prisma.runCase.count.mockResolvedValueOnce(12);

    await expect(port.countSnapshotted()).resolves.toBe(12);
    expect(prisma.runCase.count).toHaveBeenCalledWith({
      where: { catalogSnapshot: { not: Prisma.DbNull } },
    });
  });

  describe('readUnsnapshotted', () => {
    const select = {
      id: true,
      testCaseId: true,
      run: { select: { startedAt: true } },
    };

    it('reads the first page of rows with no snapshot in id order', async () => {
      const { port, prisma } = build();

      await port.readUnsnapshotted(undefined, 500);

      expect(prisma.runCase.findMany).toHaveBeenCalledWith({
        where: { catalogSnapshot: { equals: Prisma.DbNull } },
        orderBy: { id: 'asc' },
        take: 500,
        select,
      });
    });

    it('continues after the last id of the previous page', async () => {
      const { port, prisma } = build();

      await port.readUnsnapshotted('rc-9', 25);

      expect(prisma.runCase.findMany).toHaveBeenCalledWith({
        where: {
          catalogSnapshot: { equals: Prisma.DbNull },
          id: { gt: 'rc-9' },
        },
        orderBy: { id: 'asc' },
        take: 25,
        select,
      });
    });

    it('flattens the run start time and keeps a missing link as null', async () => {
      const { port, prisma } = build();
      const startedAt = new Date('2026-09-01T10:00:00.000Z');
      prisma.runCase.findMany.mockResolvedValueOnce([
        { id: 'rc-1', testCaseId: 'case-1', run: { startedAt } },
        { id: 'rc-2', testCaseId: null, run: { startedAt } },
      ]);

      await expect(port.readUnsnapshotted(undefined, 500)).resolves.toEqual([
        { id: 'rc-1', testCaseId: 'case-1', runStartedAt: startedAt },
        { id: 'rc-2', testCaseId: null, runStartedAt: startedAt },
      ]);
    });
  });

  it('reads only the versions of the given cases published up to the latest start', async () => {
    const { port, prisma } = build();
    const upTo = new Date('2026-09-01T12:00:00.000Z');
    const stored = [{ id: 'ver-1' }];
    prisma.testCaseVersion.findMany.mockResolvedValueOnce(stored);

    await expect(
      port.readPublishedVersions(['case-1', 'case-2'], upTo),
    ).resolves.toBe(stored);
    expect(prisma.testCaseVersion.findMany).toHaveBeenCalledWith({
      where: {
        testCaseId: { in: ['case-1', 'case-2'] },
        publishedAt: { lte: upTo },
      },
      select: {
        id: true,
        testCaseId: true,
        version: true,
        title: true,
        steps: true,
        expectedResult: true,
        publishedAt: true,
      },
    });
  });

  describe('applyFills', () => {
    const snapshot: RunCaseCatalogSnapshot = {
      name: 'Title v2',
      steps: ['Step'],
      expectedResult: 'Result',
      version: 2,
      origin: 'backfill',
    };

    it('writes each group only to rows that still have no snapshot and still point at the case', async () => {
      const { port, prisma } = build();
      prisma.runCase.updateMany
        .mockResolvedValueOnce({ count: 2 })
        .mockResolvedValueOnce({ count: 1 });

      const written = await port.applyFills([
        {
          testCaseId: 'case-1',
          testCaseVersionId: 'ver-2',
          snapshot,
          runCaseIds: ['rc-1', 'rc-2'],
        },
        {
          testCaseId: 'case-2',
          testCaseVersionId: 'ver-9',
          snapshot: { ...snapshot, version: 1 },
          runCaseIds: ['rc-3'],
        },
      ]);

      expect(written).toBe(3);
      expect(prisma.runCase.updateMany).toHaveBeenCalledTimes(2);
      expect(prisma.runCase.updateMany).toHaveBeenNthCalledWith(1, {
        where: {
          id: { in: ['rc-1', 'rc-2'] },
          testCaseId: 'case-1',
          catalogSnapshot: { equals: Prisma.DbNull },
        },
        data: { testCaseVersionId: 'ver-2', catalogSnapshot: snapshot },
      });
      expect(prisma.runCase.updateMany).toHaveBeenNthCalledWith(2, {
        where: {
          id: { in: ['rc-3'] },
          testCaseId: 'case-2',
          catalogSnapshot: { equals: Prisma.DbNull },
        },
        data: {
          testCaseVersionId: 'ver-9',
          catalogSnapshot: { ...snapshot, version: 1 },
        },
      });
    });

    it('runs all the groups of a batch in one transaction', async () => {
      const { port, prisma } = build();

      await port.applyFills([
        {
          testCaseId: 'case-1',
          testCaseVersionId: 'ver-2',
          snapshot,
          runCaseIds: ['rc-1'],
        },
        {
          testCaseId: 'case-2',
          testCaseVersionId: 'ver-9',
          snapshot,
          runCaseIds: ['rc-2'],
        },
      ]);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(
        (prisma.$transaction.mock.calls[0] as unknown[][])[0],
      ).toHaveLength(2);
    });

    it('writes nothing but the version link and the snapshot', async () => {
      const { port, prisma } = build();

      await port.applyFills([
        {
          testCaseId: 'case-1',
          testCaseVersionId: 'ver-2',
          snapshot,
          runCaseIds: ['rc-1'],
        },
      ]);

      const [call] = prisma.runCase.updateMany.mock.calls as [
        [{ data: Record<string, unknown> }],
      ];
      expect(Object.keys(call[0].data).sort()).toEqual([
        'catalogSnapshot',
        'testCaseVersionId',
      ]);
    });

    it('does not open a transaction when there is nothing to write', async () => {
      const { port, prisma } = build();

      await expect(port.applyFills([])).resolves.toBe(0);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
