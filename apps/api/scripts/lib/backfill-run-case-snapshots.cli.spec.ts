import {
  runSnapshotBackfillCli,
  type SnapshotBackfillCliDeps,
} from './backfill-run-case-snapshots.cli';
import type { PublishedCaseVersion } from './backfill-run-case-snapshots.lib';

const DATABASE_URL = 'postgresql://user:s3cret@db.example.internal:5432/qably';

const startedAt = new Date('2026-09-01T10:00:00.000Z');

const versionInForce: PublishedCaseVersion = {
  id: 'ver-2',
  testCaseId: 'case-1',
  version: 2,
  title: 'Title v2',
  steps: ['Step'],
  expectedResult: 'Result',
  publishedAt: new Date('2026-08-01T10:00:00.000Z'),
};

function build(overrides: Partial<SnapshotBackfillCliDeps> = {}) {
  const port = {
    countSnapshotted: jest.fn(() => Promise.resolve(7)),
    readUnsnapshotted: jest.fn((afterId?: string) =>
      Promise.resolve(
        afterId === undefined
          ? [
              { id: 'rc-1', testCaseId: 'case-1', runStartedAt: startedAt },
              { id: 'rc-2', testCaseId: null, runStartedAt: startedAt },
              { id: 'rc-3', testCaseId: 'case-draft', runStartedAt: startedAt },
            ]
          : [],
      ),
    ),
    readPublishedVersions: jest.fn(() => Promise.resolve([versionInForce])),
    applyFills: jest.fn(() => Promise.resolve(1)),
  };
  const close = jest.fn(() => Promise.resolve());
  const lines: string[] = [];
  const errors: unknown[] = [];
  const deps: SnapshotBackfillCliDeps = {
    argv: ['node', 'backfill-run-case-snapshots.ts'],
    env: { DATABASE_URL },
    openPort: jest.fn(() => ({ port, close })),
    log: (line) => lines.push(line),
    logError: (error) => errors.push(error),
    ...overrides,
  };

  return { deps, port, close, lines, errors };
}

describe('runSnapshotBackfillCli', () => {
  it('is a dry run by default: it reads, reports and writes nothing', async () => {
    const t = build();

    const code = await runSnapshotBackfillCli(t.deps);

    expect(code).toBe(0);
    expect(t.errors).toEqual([]);
    expect(t.port.applyFills).not.toHaveBeenCalled();
    expect(t.lines).toEqual([
      'Target database host: db.example.internal',
      'Mode: dry run, nothing is written',
      'Batch 1: read 3, 1 would be filled (3 scanned)',
      'Already have a snapshot (left untouched): 7',
      'Run cases without a snapshot: 3',
      'Would fill: 1',
      'No version in force when the run started (left untouched): 1',
      'No linked case (left untouched): 1',
      'Dry run: nothing was written. Re-run with --confirm to fill the rows above.',
    ]);
    expect(t.close).toHaveBeenCalledTimes(1);
  });

  it('writes only with --confirm and reports what it filled', async () => {
    const t = build({
      argv: ['node', 'backfill-run-case-snapshots.ts', '--confirm'],
    });

    const code = await runSnapshotBackfillCli(t.deps);

    expect(code).toBe(0);
    expect(t.errors).toEqual([]);
    expect(t.port.applyFills).toHaveBeenCalledTimes(1);
    expect(t.port.applyFills).toHaveBeenCalledWith([
      {
        testCaseId: 'case-1',
        testCaseVersionId: 'ver-2',
        snapshot: expect.objectContaining({ origin: 'backfill' }) as unknown,
        runCaseIds: ['rc-1'],
      },
    ]);
    expect(t.lines).toEqual([
      'Target database host: db.example.internal',
      'Mode: apply',
      'Batch 1: read 3, filled 1 (3 scanned)',
      'Already have a snapshot (left untouched): 7',
      'Run cases without a snapshot: 3',
      'Filled: 1',
      'No version in force when the run started (left untouched): 1',
      'No linked case (left untouched): 1',
      'Changed since they were read (not written): 0',
    ]);
    expect(t.close).toHaveBeenCalledTimes(1);
  });

  it('reports a row that changed between the read and the write', async () => {
    const t = build({
      argv: ['node', 'backfill-run-case-snapshots.ts', '--confirm'],
    });
    t.port.applyFills.mockResolvedValue(0);

    const code = await runSnapshotBackfillCli(t.deps);

    expect(code).toBe(0);
    expect(t.lines).toContain('Filled: 0');
    expect(t.lines).toContain('Changed since they were read (not written): 1');
  });

  it('prints nothing but the host of the connection string', async () => {
    const t = build({
      argv: ['node', 'backfill-run-case-snapshots.ts', '--confirm'],
    });

    await runSnapshotBackfillCli(t.deps);

    expect(t.lines.join('\n')).not.toMatch(/s3cret|user|qably:|5432/);
  });

  it('refuses --dry-run together with --confirm and never opens the database', async () => {
    const t = build({
      argv: [
        'node',
        'backfill-run-case-snapshots.ts',
        '--dry-run',
        '--confirm',
      ],
    });

    const code = await runSnapshotBackfillCli(t.deps);

    expect(code).toBe(1);
    expect((t.errors[0] as Error).message).toMatch(/--dry-run.*--confirm/);
    expect(t.deps.openPort).not.toHaveBeenCalled();
    expect(t.port.applyFills).not.toHaveBeenCalled();
    expect(t.lines).toEqual([]);
  });

  it('treats an explicit --dry-run as the default', async () => {
    const t = build({
      argv: ['node', 'backfill-run-case-snapshots.ts', '--dry-run'],
    });

    const code = await runSnapshotBackfillCli(t.deps);

    expect(code).toBe(0);
    expect(t.port.applyFills).not.toHaveBeenCalled();
    expect(t.lines).toContain('Mode: dry run, nothing is written');
  });

  it.each([undefined, '   '])(
    'fails with exit code 1 when DATABASE_URL is %j',
    async (databaseUrl) => {
      const t = build({ env: { DATABASE_URL: databaseUrl } });

      const code = await runSnapshotBackfillCli(t.deps);

      expect(code).toBe(1);
      expect((t.errors[0] as Error).message).toMatch(/DATABASE_URL/);
      expect(t.deps.openPort).not.toHaveBeenCalled();
    },
  );

  it('logs one line per batch', async () => {
    const t = build();
    t.port.readUnsnapshotted
      .mockResolvedValueOnce([
        { id: 'rc-1', testCaseId: 'case-1', runStartedAt: startedAt },
        { id: 'rc-2', testCaseId: 'case-1', runStartedAt: startedAt },
      ])
      .mockResolvedValueOnce([
        { id: 'rc-3', testCaseId: null, runStartedAt: startedAt },
      ])
      .mockResolvedValue([]);

    await runSnapshotBackfillCli(t.deps);

    expect(t.lines).toContain('Batch 1: read 2, 2 would be filled (2 scanned)');
    expect(t.lines).toContain('Batch 2: read 1, 0 would be filled (3 scanned)');
  });

  it('returns 1, logs the error and still closes the connection when the backfill fails', async () => {
    const t = build({
      argv: ['node', 'backfill-run-case-snapshots.ts', '--confirm'],
    });
    t.port.applyFills.mockRejectedValueOnce(new Error('connection lost'));

    const code = await runSnapshotBackfillCli(t.deps);

    expect(code).toBe(1);
    expect((t.errors[0] as Error).message).toBe('connection lost');
    expect(t.close).toHaveBeenCalledTimes(1);
    expect(t.lines).not.toContain('Filled: 1');
  });
});
