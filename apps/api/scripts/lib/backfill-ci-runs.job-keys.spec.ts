import {
  recoverJobKeys,
  type JobKeyPort,
  type RunMissingJobKey,
} from './backfill-ci-runs.job-keys';

function missing(
  id: string,
  externalId: string | null,
  extra: Partial<RunMissingJobKey> = {},
): RunMissingJobKey {
  return {
    id,
    projectId: 'proj-1',
    externalId,
    ciRunExternalId: '900',
    ...extra,
  };
}

function fakePort(
  rows: RunMissingJobKey[],
  keysByProject: Record<string, string[]> = { 'proj-1': ['api', 'web'] },
  setCount?: (ids: readonly string[]) => number,
) {
  const reads: Array<{ afterId: string | undefined; size: number }> = [];
  const keyReads: string[] = [];
  const sets: Array<{ ids: readonly string[]; ciJobKey: string }> = [];

  const port: JobKeyPort = {
    readKnownJobKeys: (projectId) => {
      keyReads.push(projectId);
      return Promise.resolve(keysByProject[projectId] ?? []);
    },
    readRunsMissingJobKey: (afterId, take) => {
      const page = rows
        .filter((row) => afterId === undefined || row.id > afterId)
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .slice(0, take);
      reads.push({ afterId, size: page.length });
      return Promise.resolve(page);
    },
    setJobKey: (ids, ciJobKey) => {
      sets.push({ ids, ciJobKey });
      return Promise.resolve(setCount?.(ids) ?? ids.length);
    },
  };

  return { port, reads, keyReads, sets };
}

describe('recoverJobKeys', () => {
  it('sets the job key that the external id of a run names and counts it', async () => {
    const t = fakePort([missing('r1', 'gha-900-api-junit-unit-xml-3425dd6f')]);

    const stats = await recoverJobKeys(t.port, 500);

    expect(t.sets).toEqual([{ ids: ['r1'], ciJobKey: 'api' }]);
    expect(stats).toEqual({ jobKeysSet: 1, jobKeysUnresolved: 0 });
  });

  it('writes one update per job key of a batch, with every run that resolves to it', async () => {
    const t = fakePort([
      missing('r1', 'gha-900-api-junit-unit-xml-3425dd6f'),
      missing('r2', 'gha-900-web-junit-xml-cd34ef56'),
      missing('r3', 'gha-900-api-junit-xml-ab12cd34-p2'),
    ]);

    const stats = await recoverJobKeys(t.port, 500);

    expect(t.sets).toEqual([
      { ids: ['r1', 'r3'], ciJobKey: 'api' },
      { ids: ['r2'], ciJobKey: 'web' },
    ]);
    expect(stats).toEqual({ jobKeysSet: 3, jobKeysUnresolved: 0 });
  });

  it('leaves a run without a write when no known key matches and counts it as unresolved', async () => {
    const t = fakePort([
      missing('r1', 'gha-900-landing-junit-xml-ef56ab78'),
      missing('r2', 'gha-local-job-junit-xml-ab12cd34'),
      missing('r3', null),
    ]);

    const stats = await recoverJobKeys(t.port, 500);

    expect(t.sets).toEqual([]);
    expect(stats).toEqual({ jobKeysSet: 0, jobKeysUnresolved: 3 });
  });

  it('matches against the run id of the CiRun the run is linked to, not any run id', async () => {
    const t = fakePort([
      missing('r1', 'gha-900-api-junit-xml-ab12cd34', {
        ciRunExternalId: '901',
      }),
    ]);

    const stats = await recoverJobKeys(t.port, 500);

    expect(t.sets).toEqual([]);
    expect(stats.jobKeysUnresolved).toBe(1);
  });

  it('prefers the longest known key and never splits the id on hyphens', async () => {
    const t = fakePort(
      [
        missing('r1', 'gha-900-build-web-junit-xml-ab12cd34'),
        missing('r2', 'gha-900-build-api-junit-xml-ab12cd34'),
      ],
      { 'proj-1': ['build', 'build-web'] },
    );

    await recoverJobKeys(t.port, 500);

    expect(t.sets).toEqual([
      { ids: ['r1'], ciJobKey: 'build-web' },
      { ids: ['r2'], ciJobKey: 'build' },
    ]);
  });

  it('keeps the known keys of each project apart', async () => {
    const t = fakePort(
      [
        missing('r1', 'gha-900-api-junit-xml-ab12cd34'),
        missing('r2', 'gha-900-api-junit-xml-ab12cd34', {
          projectId: 'proj-2',
        }),
      ],
      { 'proj-1': ['api'], 'proj-2': ['web'] },
    );

    const stats = await recoverJobKeys(t.port, 500);

    expect(t.sets).toEqual([{ ids: ['r1'], ciJobKey: 'api' }]);
    expect(stats).toEqual({ jobKeysSet: 1, jobKeysUnresolved: 1 });
  });

  it('reads the known keys of a project once, however many batches it spans', async () => {
    const t = fakePort(
      [
        missing('r1', 'gha-900-api-junit-xml-ab12cd34'),
        missing('r2', 'gha-900-api-junit-xml-ab12cd34'),
        missing('r3', 'gha-900-api-junit-xml-ab12cd34'),
        missing('r4', 'gha-900-api-junit-xml-ab12cd34', {
          projectId: 'proj-2',
        }),
      ],
      { 'proj-1': ['api'], 'proj-2': ['api'] },
    );

    await recoverJobKeys(t.port, 2);

    expect(t.keyReads).toEqual(['proj-1', 'proj-2']);
  });

  it('pages by id, moves past runs it could not resolve and stops on an empty page', async () => {
    const t = fakePort([
      missing('r1', 'gha-900-landing-junit-xml-ef56ab78'),
      missing('r2', 'gha-900-api-junit-xml-ab12cd34'),
      missing('r3', 'gha-900-landing-junit-xml-ef56ab78'),
      missing('r4', 'gha-900-web-junit-xml-cd34ef56'),
      missing('r5', 'gha-900-api-junit-xml-ab12cd34'),
    ]);

    const stats = await recoverJobKeys(t.port, 2);

    expect(t.reads).toEqual([
      { afterId: undefined, size: 2 },
      { afterId: 'r2', size: 2 },
      { afterId: 'r4', size: 1 },
      { afterId: 'r5', size: 0 },
    ]);
    expect(stats).toEqual({ jobKeysSet: 3, jobKeysUnresolved: 2 });
  });

  it('counts what the write changed, so a run that gained a key meanwhile is not counted', async () => {
    const t = fakePort(
      [
        missing('r1', 'gha-900-api-junit-xml-ab12cd34'),
        missing('r2', 'gha-900-api-junit-xml-ab12cd34'),
      ],
      undefined,
      () => 1,
    );

    const stats = await recoverJobKeys(t.port, 500);

    expect(stats.jobKeysSet).toBe(1);
  });

  it('asks for nothing when there is no run to recover', async () => {
    const t = fakePort([]);

    const stats = await recoverJobKeys(t.port, 500);

    expect(t.keyReads).toEqual([]);
    expect(t.sets).toEqual([]);
    expect(stats).toEqual({ jobKeysSet: 0, jobKeysUnresolved: 0 });
  });
});
