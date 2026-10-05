import { runBackfillCli, type BackfillCliDeps } from './backfill-ci-runs.cli';
import type { BackfillRunRow } from './backfill-ci-runs.lib';

const DATABASE_URL = 'postgresql://user:s3cret@db.example.internal:5432/qably';

const unlinkedRun: BackfillRunRow = {
  id: 'r1',
  projectId: 'proj-1',
  organizationId: 'org-1',
  source: 'github_actions',
  externalId: 'gha-900-api-junit-xml-ab12cd34',
  startedAt: new Date('2026-09-01T10:00:00.000Z'),
  commitSha: null,
  commitMessage: null,
  commitAuthor: null,
};

function build(overrides: Partial<BackfillCliDeps> = {}) {
  const port = {
    readUnlinkedRuns: jest.fn((afterId?: string) =>
      Promise.resolve(afterId === undefined ? [unlinkedRun] : []),
    ),
    findCiRun: jest.fn(() => Promise.resolve(null)),
    createCiRun: jest.fn(() => Promise.resolve('ci-1')),
    updateCiRunIfUnchanged: jest.fn(() => Promise.resolve(true)),
    linkRuns: jest.fn(() => Promise.resolve(1)),
    readKnownJobKeys: jest.fn(() => Promise.resolve(['api'])),
    readRunsMissingJobKey: jest.fn((afterId?: string) =>
      Promise.resolve(
        afterId === undefined
          ? [
              {
                id: 'r1',
                projectId: 'proj-1',
                externalId: unlinkedRun.externalId,
                ciRunExternalId: '900',
              },
            ]
          : [],
      ),
    ),
    setJobKey: jest.fn(() => Promise.resolve(1)),
  };
  const close = jest.fn(() => Promise.resolve());
  const lines: string[] = [];
  const errors: unknown[] = [];
  const deps: BackfillCliDeps = {
    argv: ['node', 'backfill-ci-runs.ts', '--confirm'],
    env: { DATABASE_URL },
    openPort: jest.fn(() => ({ port, close })),
    log: (line) => lines.push(line),
    logError: (error) => errors.push(error),
    ...overrides,
  };

  return { deps, port, close, lines, errors };
}

describe('runBackfillCli', () => {
  it('fails with exit code 1 and never opens the database without --confirm', async () => {
    const t = build({ argv: ['node', 'backfill-ci-runs.ts'] });

    const code = await runBackfillCli(t.deps);

    expect(code).toBe(1);
    expect((t.errors[0] as Error).message).toMatch(/--confirm/);
    expect(t.deps.openPort).not.toHaveBeenCalled();
    expect(t.port.createCiRun).not.toHaveBeenCalled();
    expect(t.port.updateCiRunIfUnchanged).not.toHaveBeenCalled();
    expect(t.port.linkRuns).not.toHaveBeenCalled();
    expect(t.lines).toEqual([]);
  });

  it.each([undefined, '   '])(
    'fails with exit code 1 when DATABASE_URL is %j',
    async (databaseUrl) => {
      const t = build({ env: { DATABASE_URL: databaseUrl } });

      const code = await runBackfillCli(t.deps);

      expect(code).toBe(1);
      expect((t.errors[0] as Error).message).toMatch(/DATABASE_URL/);
      expect(t.deps.openPort).not.toHaveBeenCalled();
    },
  );

  it('backfills, prints only the host and the summary, and closes the connection', async () => {
    const t = build();

    const code = await runBackfillCli(t.deps);

    expect(code).toBe(0);
    expect(t.errors).toEqual([]);
    expect(t.port.createCiRun).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'proj-1', externalId: '900' }),
    );
    expect(t.lines).toEqual([
      'Target database host: db.example.internal',
      'Scanned: 1',
      'Unattributable (left untouched): 0',
      'CiRuns created: 1',
      'CiRuns updated: 0',
      'Runs linked: 1',
      'Job keys set: 1',
      'Linked runs left without a job key: 0',
    ]);
    expect(t.port.setJobKey).toHaveBeenCalledWith(['r1'], 'api');
    expect(t.lines.join('\n')).not.toMatch(/s3cret|user/);
    expect(t.close).toHaveBeenCalledTimes(1);
  });

  it('returns 1, logs the error and still closes the connection when the backfill fails', async () => {
    const t = build();
    t.port.readUnlinkedRuns.mockRejectedValueOnce(new Error('connection lost'));

    const code = await runBackfillCli(t.deps);

    expect(code).toBe(1);
    expect((t.errors[0] as Error).message).toBe('connection lost');
    expect(t.close).toHaveBeenCalledTimes(1);
    expect(t.lines).toEqual(['Target database host: db.example.internal']);
  });
});
