import { parseCatalogSnapshot } from '../../src/modules/runs/lib/catalog-snapshot';
import {
  DEFAULT_BATCH_SIZE,
  backfillRunCaseSnapshots,
  buildBackfillSnapshot,
  selectVersionInForce,
  type BatchProgress,
  type PublishedCaseVersion,
  type SnapshotBackfillPort,
  type SnapshotFillGroup,
  type UnsnapshottedRunCase,
} from './backfill-run-case-snapshots.lib';

const at = (minutes: number) => new Date(Date.UTC(2026, 8, 1, 10, minutes));

function version(
  id: string,
  testCaseId: string,
  number: number,
  publishedMinutes: number,
  extra: Partial<PublishedCaseVersion> = {},
): PublishedCaseVersion {
  return {
    id,
    testCaseId,
    version: number,
    title: `Title v${number}`,
    steps: [`Step of v${number}`],
    expectedResult: `Result of v${number}`,
    publishedAt: at(publishedMinutes),
    ...extra,
  };
}

describe('selectVersionInForce', () => {
  const v1 = version('ver-1', 'case-1', 1, 0);
  const v2 = version('ver-2', 'case-1', 2, 30);
  const v3 = version('ver-3', 'case-1', 3, 60);

  it('picks the latest version published at or before the start', () => {
    expect(selectVersionInForce([v1, v2, v3], at(45))).toBe(v2);
  });

  it('counts a version published at the exact instant the run started', () => {
    expect(selectVersionInForce([v1, v2, v3], at(30))).toBe(v2);
  });

  it('ignores a version published one millisecond after the start', () => {
    const justAfter = version('ver-x', 'case-1', 2, 0, {
      publishedAt: new Date(at(30).getTime() + 1),
    });

    expect(selectVersionInForce([v1, justAfter], at(30))).toBe(v1);
  });

  it('ignores every version published after the start', () => {
    expect(selectVersionInForce([v2, v3], at(10))).toBeUndefined();
  });

  it('returns undefined when the case has no version at all', () => {
    expect(selectVersionInForce([], at(10))).toBeUndefined();
  });

  it('does not depend on the order the versions arrive in', () => {
    expect(selectVersionInForce([v3, v1, v2], at(100))).toBe(v3);
    expect(selectVersionInForce([v2, v3, v1], at(45))).toBe(v2);
  });

  it('breaks a publication tie with the higher version number', () => {
    const first = version('ver-a', 'case-1', 4, 20);
    const second = version('ver-b', 'case-1', 5, 20);

    expect(selectVersionInForce([second, first], at(20))).toBe(second);
    expect(selectVersionInForce([first, second], at(20))).toBe(second);
  });
});

describe('buildBackfillSnapshot', () => {
  it('copies the version content and marks the snapshot as a backfill', () => {
    expect(buildBackfillSnapshot(version('ver-2', 'case-1', 2, 30))).toEqual({
      name: 'Title v2',
      steps: ['Step of v2'],
      expectedResult: 'Result of v2',
      version: 2,
      origin: 'backfill',
    });
  });

  it('keeps an undocumented version as empty steps and an empty expected result', () => {
    const snapshot = buildBackfillSnapshot(
      version('ver-1', 'case-1', 1, 0, { steps: [], expectedResult: '' }),
    );

    expect(snapshot.steps).toEqual([]);
    expect(snapshot.expectedResult).toBe('');
  });

  it('detaches the steps from the version row', () => {
    const row = version('ver-1', 'case-1', 1, 0);
    const snapshot = buildBackfillSnapshot(row);

    row.steps.push('Added later');

    expect(snapshot.steps).toEqual(['Step of v1']);
  });

  it('produces a value the read path accepts unchanged', () => {
    const snapshot = buildBackfillSnapshot(version('ver-2', 'case-1', 2, 30));

    expect(parseCatalogSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(
      snapshot,
    );
  });
});

interface StoredRunCase extends UnsnapshottedRunCase {
  testCaseVersionId: string | null;
  catalogSnapshot: unknown;
}

function runCase(
  id: string,
  testCaseId: string | null,
  startedMinutes: number,
  extra: Partial<StoredRunCase> = {},
): StoredRunCase {
  return {
    id,
    testCaseId,
    runStartedAt: at(startedMinutes),
    testCaseVersionId: null,
    catalogSnapshot: null,
    ...extra,
  };
}

function fakeDb(
  runCases: StoredRunCase[],
  versions: PublishedCaseVersion[],
  hooks: { afterRead?: (reads: number) => void } = {},
) {
  const reads: { afterId: string | undefined; returned: number }[] = [];
  const versionReads: { testCaseIds: string[]; publishedUpTo: Date }[] = [];
  const writes: SnapshotFillGroup[][] = [];

  const port: SnapshotBackfillPort = {
    countSnapshotted: () =>
      Promise.resolve(
        runCases.filter((r) => r.catalogSnapshot !== null).length,
      ),
    readUnsnapshotted: (afterId, take) => {
      const page = runCases
        .filter(
          (row) =>
            row.catalogSnapshot === null &&
            (afterId === undefined || row.id > afterId),
        )
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .slice(0, take)
        .map(({ id, testCaseId, runStartedAt }) => ({
          id,
          testCaseId,
          runStartedAt,
        }));
      reads.push({ afterId, returned: page.length });
      hooks.afterRead?.(reads.length);
      return Promise.resolve(page);
    },
    readPublishedVersions: (testCaseIds, publishedUpTo) => {
      versionReads.push({ testCaseIds: [...testCaseIds], publishedUpTo });
      return Promise.resolve(
        versions.filter(
          (row) =>
            testCaseIds.includes(row.testCaseId) &&
            row.publishedAt <= publishedUpTo,
        ),
      );
    },
    applyFills: (groups) => {
      writes.push([...groups]);
      let changed = 0;
      for (const group of groups) {
        for (const id of group.runCaseIds) {
          const row = runCases.find((candidate) => candidate.id === id);
          if (
            row === undefined ||
            row.catalogSnapshot !== null ||
            row.testCaseId !== group.testCaseId
          ) {
            continue;
          }
          row.testCaseVersionId = group.testCaseVersionId;
          row.catalogSnapshot = group.snapshot;
          changed += 1;
        }
      }
      return Promise.resolve(changed);
    },
  };

  return { port, runCases, reads, versionReads, writes };
}

const caseVersions = [
  version('ver-1', 'case-1', 1, 0),
  version('ver-2', 'case-1', 2, 30),
  version('ver-3', 'case-1', 3, 60),
  version('ver-9', 'case-2', 1, 20),
];

describe('backfillRunCaseSnapshots', () => {
  it('fills a run case with the version in force when its run started', async () => {
    const db = fakeDb([runCase('rc-1', 'case-1', 45)], caseVersions);

    const summary = await backfillRunCaseSnapshots(db.port, { apply: true });

    expect(db.runCases[0].testCaseVersionId).toBe('ver-2');
    expect(db.runCases[0].catalogSnapshot).toEqual({
      name: 'Title v2',
      steps: ['Step of v2'],
      expectedResult: 'Result of v2',
      version: 2,
      origin: 'backfill',
    });
    expect(summary).toEqual({
      apply: true,
      alreadySnapshotted: 0,
      scanned: 1,
      eligible: 1,
      filled: 1,
      changedSinceRead: 0,
      noVersionInForce: 0,
      noLinkedCase: 0,
    });
  });

  it('chooses the version per run case, not per test case', async () => {
    const db = fakeDb(
      [
        runCase('rc-1', 'case-1', 10),
        runCase('rc-2', 'case-1', 30),
        runCase('rc-3', 'case-1', 90),
      ],
      caseVersions,
    );

    await backfillRunCaseSnapshots(db.port, { apply: true });

    expect(db.runCases.map((row) => row.testCaseVersionId)).toEqual([
      'ver-1',
      'ver-2',
      'ver-3',
    ]);
  });

  it('leaves a run case untouched when no version existed yet at the start', async () => {
    const db = fakeDb([runCase('rc-1', 'case-1', -5)], caseVersions);

    const summary = await backfillRunCaseSnapshots(db.port, { apply: true });

    expect(db.runCases[0].testCaseVersionId).toBeNull();
    expect(db.runCases[0].catalogSnapshot).toBeNull();
    expect(db.writes).toEqual([]);
    expect(summary).toMatchObject({
      scanned: 1,
      eligible: 0,
      filled: 0,
      noVersionInForce: 1,
    });
  });

  it('leaves a run case untouched when its test case never had a version (a draft)', async () => {
    const db = fakeDb([runCase('rc-1', 'case-draft', 45)], caseVersions);

    const summary = await backfillRunCaseSnapshots(db.port, { apply: true });

    expect(db.runCases[0].catalogSnapshot).toBeNull();
    expect(summary).toMatchObject({ eligible: 0, noVersionInForce: 1 });
  });

  it('leaves a run case untouched when its catalog case was deleted', async () => {
    const db = fakeDb([runCase('rc-1', null, 45)], caseVersions);

    const summary = await backfillRunCaseSnapshots(db.port, { apply: true });

    expect(db.runCases[0].testCaseVersionId).toBeNull();
    expect(db.runCases[0].catalogSnapshot).toBeNull();
    expect(db.writes).toEqual([]);
    expect(db.versionReads).toEqual([]);
    expect(summary).toMatchObject({
      scanned: 1,
      eligible: 0,
      noLinkedCase: 1,
      noVersionInForce: 0,
    });
  });

  it.each([
    [
      'an ingest snapshot',
      {
        name: 'Edited since',
        steps: [],
        expectedResult: '',
        version: 7,
        origin: 'ingest',
      },
    ],
    [
      'a snapshot without an origin',
      { name: 'Written by A3.1', steps: [], expectedResult: '', version: 1 },
    ],
    ['a malformed snapshot', { name: 42 }],
  ])('never overwrites a row that already holds %s', async (_label, held) => {
    const db = fakeDb(
      [
        runCase('rc-1', 'case-1', 45, {
          catalogSnapshot: held,
          testCaseVersionId: 'ver-held',
        }),
      ],
      caseVersions,
    );

    const summary = await backfillRunCaseSnapshots(db.port, { apply: true });

    expect(db.runCases[0].catalogSnapshot).toBe(held);
    expect(db.runCases[0].testCaseVersionId).toBe('ver-held');
    expect(db.writes).toEqual([]);
    expect(summary).toMatchObject({
      alreadySnapshotted: 1,
      scanned: 0,
      eligible: 0,
    });
  });

  it('reports every outcome in one pass over a mixed table', async () => {
    const db = fakeDb(
      [
        runCase('rc-1', 'case-1', 45),
        runCase('rc-2', 'case-2', 25),
        runCase('rc-3', 'case-2', 5),
        runCase('rc-4', null, 45),
        runCase('rc-5', 'case-1', 45, {
          catalogSnapshot: { name: 'x', steps: [], expectedResult: '' },
        }),
      ],
      caseVersions,
    );

    const summary = await backfillRunCaseSnapshots(db.port, { apply: true });

    expect(summary).toEqual({
      apply: true,
      alreadySnapshotted: 1,
      scanned: 4,
      eligible: 2,
      filled: 2,
      changedSinceRead: 0,
      noVersionInForce: 1,
      noLinkedCase: 1,
    });
  });

  describe('dry run', () => {
    it('writes nothing and still reports what apply would fill', async () => {
      const rows = [
        runCase('rc-1', 'case-1', 45),
        runCase('rc-2', 'case-2', 5),
        runCase('rc-3', null, 45),
        runCase('rc-4', 'case-1', 45, {
          catalogSnapshot: { name: 'x', steps: [], expectedResult: '' },
        }),
      ];
      const db = fakeDb(rows, caseVersions);

      const summary = await backfillRunCaseSnapshots(db.port, { apply: false });

      expect(db.writes).toEqual([]);
      expect(db.runCases[0].catalogSnapshot).toBeNull();
      expect(db.runCases[0].testCaseVersionId).toBeNull();
      expect(summary).toEqual({
        apply: false,
        alreadySnapshotted: 1,
        scanned: 3,
        eligible: 1,
        filled: 0,
        changedSinceRead: 0,
        noVersionInForce: 1,
        noLinkedCase: 1,
      });
    });

    it('reports the same eligible count that a following apply fills', async () => {
      const rows = [
        runCase('rc-1', 'case-1', 45),
        runCase('rc-2', 'case-1', 70),
        runCase('rc-3', 'case-2', 25),
      ];
      const db = fakeDb(rows, caseVersions);

      const dry = await backfillRunCaseSnapshots(db.port, { apply: false });
      const applied = await backfillRunCaseSnapshots(db.port, { apply: true });

      expect(applied.filled).toBe(dry.eligible);
    });

    it('walks every batch without writing, whatever the batch size', async () => {
      const rows = ['a', 'b', 'c', 'd', 'e'].map((id) =>
        runCase(`rc-${id}`, 'case-1', 45),
      );
      const db = fakeDb(rows, caseVersions);

      const summary = await backfillRunCaseSnapshots(db.port, {
        apply: false,
        batchSize: 2,
      });

      expect(summary.eligible).toBe(5);
      expect(db.writes).toEqual([]);
    });
  });

  describe('idempotency', () => {
    it('finds nothing to fill on a second run and writes nothing', async () => {
      const db = fakeDb(
        [
          runCase('rc-1', 'case-1', 45),
          runCase('rc-2', 'case-2', 5),
          runCase('rc-3', null, 45),
        ],
        caseVersions,
      );

      const first = await backfillRunCaseSnapshots(db.port, { apply: true });
      const writesAfterFirst = db.writes.length;
      const second = await backfillRunCaseSnapshots(db.port, { apply: true });

      expect(first.filled).toBe(1);
      expect(second).toEqual({
        apply: true,
        alreadySnapshotted: 1,
        scanned: 2,
        eligible: 0,
        filled: 0,
        changedSinceRead: 0,
        noVersionInForce: 1,
        noLinkedCase: 1,
      });
      expect(db.writes.length).toBe(writesAfterFirst);
    });

    it('leaves the stored values byte-identical on a second run', async () => {
      const db = fakeDb(
        [runCase('rc-1', 'case-1', 45), runCase('rc-2', 'case-1', 90)],
        caseVersions,
      );

      await backfillRunCaseSnapshots(db.port, { apply: true });
      const before = JSON.stringify(db.runCases);
      await backfillRunCaseSnapshots(db.port, { apply: true });

      expect(JSON.stringify(db.runCases)).toBe(before);
    });
  });

  describe('batching', () => {
    it('defaults to 500 rows per batch', () => {
      expect(DEFAULT_BATCH_SIZE).toBe(500);
    });

    it('reads in id order with a keyset cursor and never past the batch size', async () => {
      const rows = Array.from({ length: 5 }, (_, index) =>
        runCase(`rc-${index}`, 'case-1', 45),
      );
      const db = fakeDb(rows, caseVersions);

      await backfillRunCaseSnapshots(db.port, { apply: true, batchSize: 2 });

      expect(db.reads).toEqual([
        { afterId: undefined, returned: 2 },
        { afterId: 'rc-1', returned: 2 },
        { afterId: 'rc-3', returned: 1 },
        { afterId: 'rc-4', returned: 0 },
      ]);
    });

    it('fills every row exactly once across a batch boundary', async () => {
      const rows = Array.from({ length: 1201 }, (_, index) =>
        runCase(`rc-${String(index).padStart(5, '0')}`, 'case-1', 45),
      );
      const db = fakeDb(rows, caseVersions);

      const summary = await backfillRunCaseSnapshots(db.port, { apply: true });

      expect(db.reads.map((read) => read.returned)).toEqual([500, 500, 201, 0]);
      expect(summary.filled).toBe(1201);
      expect(
        db.runCases.every((row) => row.testCaseVersionId === 'ver-2'),
      ).toBe(true);
      const written = db.writes.flatMap((batch) =>
        batch.flatMap((group) => group.runCaseIds),
      );
      expect(new Set(written).size).toBe(1201);
      expect(written).toHaveLength(1201);
    });

    it('writes once per batch, never one statement group for the whole table', async () => {
      const rows = Array.from({ length: 5 }, (_, index) =>
        runCase(`rc-${index}`, 'case-1', 45),
      );
      const db = fakeDb(rows, caseVersions);

      await backfillRunCaseSnapshots(db.port, { apply: true, batchSize: 2 });

      expect(db.writes).toHaveLength(3);
      expect(
        db.writes.map((batch) =>
          batch.reduce((sum, group) => sum + group.runCaseIds.length, 0),
        ),
      ).toEqual([2, 2, 1]);
    });

    it('does not write for a batch with nothing eligible', async () => {
      const rows = [
        runCase('rc-0', null, 45),
        runCase('rc-1', null, 45),
        runCase('rc-2', 'case-1', 45),
      ];
      const db = fakeDb(rows, caseVersions);

      await backfillRunCaseSnapshots(db.port, { apply: true, batchSize: 2 });

      expect(db.writes).toHaveLength(1);
    });

    it('groups the rows of a batch that share a version into one fill', async () => {
      const rows = [
        runCase('rc-0', 'case-1', 45),
        runCase('rc-1', 'case-1', 46),
        runCase('rc-2', 'case-1', 90),
        runCase('rc-3', 'case-2', 45),
      ];
      const db = fakeDb(rows, caseVersions);

      await backfillRunCaseSnapshots(db.port, { apply: true });

      const groups = db.writes[0];
      expect(groups.map((group) => group.testCaseVersionId).sort()).toEqual([
        'ver-2',
        'ver-3',
        'ver-9',
      ]);
      expect(
        groups.find((group) => group.testCaseVersionId === 'ver-2'),
      ).toEqual({
        testCaseId: 'case-1',
        testCaseVersionId: 'ver-2',
        snapshot: expect.objectContaining({ version: 2 }) as unknown,
        runCaseIds: ['rc-0', 'rc-1'],
      });
    });

    it('asks for the versions of the distinct linked cases up to the latest start in the batch', async () => {
      const rows = [
        runCase('rc-0', 'case-1', 45),
        runCase('rc-1', 'case-2', 25),
        runCase('rc-2', 'case-1', 70),
        runCase('rc-3', null, 99),
      ];
      const db = fakeDb(rows, caseVersions);

      await backfillRunCaseSnapshots(db.port, { apply: false });

      expect(db.versionReads).toHaveLength(1);
      expect([...db.versionReads[0].testCaseIds].sort()).toEqual([
        'case-1',
        'case-2',
      ]);
      expect(db.versionReads[0].publishedUpTo).toEqual(at(70));
    });

    it('applies the start-time rule even when the port returns later versions', async () => {
      const db = fakeDb([runCase('rc-1', 'case-1', 10)], caseVersions);
      db.port.readPublishedVersions = () => Promise.resolve(caseVersions);

      await backfillRunCaseSnapshots(db.port, { apply: true });

      expect(db.runCases[0].testCaseVersionId).toBe('ver-1');
    });

    it('reports progress after every batch', async () => {
      const rows = Array.from({ length: 5 }, (_, index) =>
        runCase(`rc-${index}`, index === 4 ? null : 'case-1', 45),
      );
      const db = fakeDb(rows, caseVersions);
      const progress: BatchProgress[] = [];

      await backfillRunCaseSnapshots(db.port, {
        apply: true,
        batchSize: 2,
        onBatch: (entry) => progress.push(entry),
      });

      expect(progress).toEqual([
        { batch: 1, read: 2, eligible: 2, filled: 2, scanned: 2 },
        { batch: 2, read: 2, eligible: 2, filled: 2, scanned: 4 },
        { batch: 3, read: 1, eligible: 0, filled: 0, scanned: 5 },
      ]);
    });
  });

  describe('rows that change between the read and the write', () => {
    it('counts a row that gained a snapshot meanwhile instead of overwriting it', async () => {
      const raced = { name: 'Live ingest won', steps: [], expectedResult: '' };
      const db = fakeDb(
        [runCase('rc-1', 'case-1', 45), runCase('rc-2', 'case-1', 45)],
        caseVersions,
        {
          afterRead: (reads) => {
            if (reads === 1) {
              const row = db.runCases.find((r) => r.id === 'rc-2');
              if (row !== undefined) row.catalogSnapshot = raced;
            }
          },
        },
      );

      const summary = await backfillRunCaseSnapshots(db.port, { apply: true });

      expect(db.runCases[1].catalogSnapshot).toBe(raced);
      expect(summary).toMatchObject({
        eligible: 2,
        filled: 1,
        changedSinceRead: 1,
      });
    });

    it('does not fill a row whose catalog case was unlinked after the read', async () => {
      const db = fakeDb([runCase('rc-1', 'case-1', 45)], caseVersions, {
        afterRead: (reads) => {
          if (reads === 1) db.runCases[0].testCaseId = null;
        },
      });

      const summary = await backfillRunCaseSnapshots(db.port, { apply: true });

      expect(db.runCases[0].catalogSnapshot).toBeNull();
      expect(summary).toMatchObject({ filled: 0, changedSinceRead: 1 });
    });
  });

  it('propagates a port failure instead of reporting a partial success', async () => {
    const db = fakeDb([runCase('rc-1', 'case-1', 45)], caseVersions);
    db.port.applyFills = () => Promise.reject(new Error('connection lost'));

    await expect(
      backfillRunCaseSnapshots(db.port, { apply: true }),
    ).rejects.toThrow('connection lost');
  });
});
