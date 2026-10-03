import {
  backfillCiRuns,
  parseCiRunExternalId,
  type BackfillPort,
  type BackfillRunRow,
  type NewCiRun,
} from './backfill-ci-runs.lib';

interface StoredRun extends BackfillRunRow {
  ciRunId: string | null;
}

const at = (minutes: number) => new Date(Date.UTC(2026, 8, 1, 10, minutes));

function stored(
  id: string,
  externalId: string | null,
  minutes: number,
  extra: Partial<StoredRun> = {},
): StoredRun {
  return {
    id,
    projectId: 'proj-1',
    organizationId: 'org-1',
    source: 'github_actions',
    externalId,
    startedAt: at(minutes),
    commitSha: null,
    commitMessage: null,
    commitAuthor: null,
    ciRunId: null,
    ...extra,
  };
}

type StoredCiRun = NewCiRun & { id: string };

function liveCiRun(extra: Partial<StoredCiRun> = {}): StoredCiRun {
  return {
    id: 'ci-live',
    projectId: 'proj-1',
    organizationId: 'org-1',
    source: 'github_actions',
    externalId: '900',
    startedAt: at(30),
    lastReportedAt: at(31),
    ...extra,
  };
}

function fakeDb(runs: StoredRun[], ciRuns: StoredCiRun[] = []) {
  const reads: number[] = [];
  const linkSizes: number[] = [];
  const writes = { create: 0, update: 0, link: 0 };

  const port: BackfillPort = {
    readUnlinkedRuns: (afterId, take) => {
      const page = runs
        .filter(
          (run) =>
            run.ciRunId === null && (afterId === undefined || run.id > afterId),
        )
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .slice(0, take);
      reads.push(page.length);
      return Promise.resolve(page);
    },
    findCiRun: (key) => {
      const row = ciRuns.find(
        (candidate) =>
          candidate.projectId === key.projectId &&
          candidate.source === key.source &&
          candidate.externalId === key.externalId,
      );
      return Promise.resolve(
        row === undefined
          ? null
          : {
              id: row.id,
              startedAt: row.startedAt,
              lastReportedAt: row.lastReportedAt,
              commitSha: row.commitSha ?? null,
              commitMessage: row.commitMessage ?? null,
              commitAuthor: row.commitAuthor ?? null,
            },
      );
    },
    createCiRun: (input) => {
      const id = `ci-${ciRuns.length + 1}`;
      ciRuns.push({ ...input, id });
      writes.create += 1;
      return Promise.resolve(id);
    },
    updateCiRun: (id, patch) => {
      Object.assign(ciRuns.find((row) => row.id === id) ?? {}, patch);
      writes.update += 1;
      return Promise.resolve();
    },
    linkRuns: (ciRunId, runIds) => {
      linkSizes.push(runIds.length);
      let linked = 0;
      for (const run of runs) {
        if (runIds.includes(run.id) && run.ciRunId === null) {
          run.ciRunId = ciRunId;
          linked += 1;
        }
      }
      writes.link += linked;
      return Promise.resolve(linked);
    },
  };

  return { port, runs, ciRuns, reads, linkSizes, writes };
}

describe('parseCiRunExternalId', () => {
  it.each([
    ['gha-900-api-junit-unit-xml-ab12cd34', '900'],
    ['gha-900-api-junit-xml-ab12cd34-p2', '900'],
    ['gha-18446744073-web-junit-xml-cd34ef56', '18446744073'],
  ])('extracts the numeric run id from %s', (externalId, expected) => {
    expect(parseCiRunExternalId(externalId)).toBe(expected);
  });

  it.each<string | null>([
    'gha-local-job-junit-xml-ab12cd34',
    'gha-abc-api-junit-xml-ab12cd34',
    'gha-900',
    'run-900-api',
    '',
    null,
  ])('returns undefined for %s', (externalId) => {
    expect(parseCiRunExternalId(externalId)).toBeUndefined();
  });
});

describe('backfillCiRuns grouping', () => {
  it('groups three reports of one GitHub run into one CiRun and links them all', async () => {
    const db = fakeDb([
      stored('r1', 'gha-900-api-junit-unit-xml-ab12cd34', 10, {
        commitSha: 'a41f9c2',
        commitMessage: 'fix: retry the checkout call',
        commitAuthor: 'ana',
      }),
      stored('r2', 'gha-900-web-junit-xml-cd34ef56', 12),
      stored('r3', 'gha-900-api-junit-xml-ab12cd34-p2', 11),
    ]);

    const summary = await backfillCiRuns(db.port);

    expect(db.ciRuns).toHaveLength(1);
    expect(db.ciRuns[0]).toMatchObject({
      projectId: 'proj-1',
      organizationId: 'org-1',
      source: 'github_actions',
      externalId: '900',
      commitSha: 'a41f9c2',
      commitMessage: 'fix: retry the checkout call',
      commitAuthor: 'ana',
    });
    expect(db.runs.map((run) => run.ciRunId)).toEqual(
      Array<string>(3).fill(db.ciRuns[0].id),
    );
    expect(summary).toEqual({
      scanned: 3,
      unattributable: 0,
      ciRunsCreated: 1,
      ciRunsUpdated: 0,
      runsLinked: 3,
    });
  });

  it('sets startedAt and lastReportedAt to the min and max of Run.startedAt', async () => {
    const db = fakeDb([
      stored('r1', 'gha-900-api-junit-xml-ab12cd34', 20),
      stored('r2', 'gha-900-web-junit-xml-cd34ef56', 5),
      stored('r3', 'gha-900-landing-junit-xml-ef56ab78', 12),
    ]);

    await backfillCiRuns(db.port);

    expect(db.ciRuns[0].startedAt).toEqual(at(5));
    expect(db.ciRuns[0].lastReportedAt).toEqual(at(20));
  });

  it('keeps the same external id in other projects and sources as separate CiRuns', async () => {
    const db = fakeDb([
      stored('r1', 'gha-900-api-junit-xml-ab12cd34', 10),
      stored('r2', 'gha-900-api-junit-xml-ab12cd34', 11, {
        projectId: 'proj-2',
        organizationId: 'org-2',
      }),
      stored('r3', 'gha-900-api-junit-xml-ab12cd34', 12, { source: 'api' }),
    ]);

    const summary = await backfillCiRuns(db.port);

    expect(summary.ciRunsCreated).toBe(3);
    expect(db.ciRuns).toMatchObject([
      {
        projectId: 'proj-1',
        organizationId: 'org-1',
        source: 'github_actions',
      },
      {
        projectId: 'proj-2',
        organizationId: 'org-2',
        source: 'github_actions',
      },
      { projectId: 'proj-1', organizationId: 'org-1', source: 'api' },
    ]);
    expect(new Set(db.runs.map((run) => run.ciRunId)).size).toBe(3);
  });
});

describe('backfillCiRuns unattributable runs', () => {
  it('counts them and never touches them', async () => {
    const db = fakeDb([
      stored('r1', 'gha-900-api-junit-xml-ab12cd34', 10),
      stored('r2', 'gha-local-job-junit-xml-ab12cd34', 11),
      stored('r3', 'gha-abc-api-junit-xml-ab12cd34', 12),
      stored('r4', null, 13, { source: 'manual' }),
    ]);

    const summary = await backfillCiRuns(db.port);

    expect(summary).toEqual({
      scanned: 4,
      unattributable: 3,
      ciRunsCreated: 1,
      ciRunsUpdated: 0,
      runsLinked: 1,
    });
    expect(db.runs.map((run) => run.ciRunId)).toEqual([
      db.ciRuns[0].id,
      null,
      null,
      null,
    ]);
    expect(db.writes).toEqual({ create: 1, update: 0, link: 1 });
  });
});

describe('backfillCiRuns idempotency', () => {
  it('creates 0 CiRuns, links 0 Runs and reports the same unattributable count on a second pass', async () => {
    const db = fakeDb([
      stored('r1', 'gha-900-api-junit-xml-ab12cd34', 10),
      stored('r2', 'gha-901-api-junit-xml-ab12cd34', 11),
      stored('r3', 'gha-local-job-junit-xml-ab12cd34', 12),
      stored('r4', null, 13),
    ]);

    const first = await backfillCiRuns(db.port);
    const writesAfterFirst = { ...db.writes };
    const second = await backfillCiRuns(db.port);

    expect(first).toMatchObject({ ciRunsCreated: 2, runsLinked: 2 });
    expect(second.unattributable).toBe(first.unattributable);
    expect(second).toEqual({
      scanned: 2,
      unattributable: 2,
      ciRunsCreated: 0,
      ciRunsUpdated: 0,
      runsLinked: 0,
    });
    expect(db.writes).toEqual(writesAfterFirst);
  });
});

describe('backfillCiRuns against an existing CiRun', () => {
  it('links to the CiRun of the same project and source instead of creating a second one', async () => {
    const db = fakeDb(
      [stored('r1', 'gha-900-api-junit-xml-ab12cd34', 30)],
      [
        liveCiRun({ id: 'ci-other-project', projectId: 'proj-2' }),
        liveCiRun({ id: 'ci-other-source', source: 'api' }),
        liveCiRun(),
      ],
    );

    const summary = await backfillCiRuns(db.port);

    expect(db.ciRuns).toHaveLength(3);
    expect(db.runs[0].ciRunId).toBe('ci-live');
    expect(summary).toMatchObject({ ciRunsCreated: 0, runsLinked: 1 });
  });

  it('pulls a live CiRun back to the earliest Run and keeps the later lastReportedAt', async () => {
    const db = fakeDb(
      [
        stored('r1', 'gha-900-api-junit-xml-ab12cd34', 5),
        stored('r2', 'gha-900-web-junit-xml-cd34ef56', 10),
      ],
      [liveCiRun()],
    );

    const summary = await backfillCiRuns(db.port);

    expect(db.ciRuns[0].startedAt).toEqual(at(5));
    expect(db.ciRuns[0].lastReportedAt).toEqual(at(31));
    expect(summary).toMatchObject({ ciRunsCreated: 0, ciRunsUpdated: 1 });
  });

  it('pushes lastReportedAt forward when the Runs are newer than the stored row', async () => {
    const db = fakeDb(
      [stored('r1', 'gha-900-api-junit-xml-ab12cd34', 45)],
      [liveCiRun()],
    );

    await backfillCiRuns(db.port);

    expect(db.ciRuns[0].startedAt).toEqual(at(30));
    expect(db.ciRuns[0].lastReportedAt).toEqual(at(45));
  });

  it('never overwrites a stored commit field but fills the missing ones', async () => {
    const db = fakeDb(
      [
        stored('r1', 'gha-900-api-junit-xml-ab12cd34', 30, {
          commitSha: 'old-sha',
          commitMessage: 'old message',
          commitAuthor: 'bob',
        }),
      ],
      [liveCiRun({ commitSha: 'live-sha', commitAuthor: 'ana' })],
    );

    await backfillCiRuns(db.port);

    expect(db.ciRuns[0]).toMatchObject({
      commitSha: 'live-sha',
      commitMessage: 'old message',
      commitAuthor: 'ana',
    });
  });

  it('skips the CiRun write when the stored row already covers the group', async () => {
    const db = fakeDb(
      [stored('r1', 'gha-900-api-junit-xml-ab12cd34', 30)],
      [liveCiRun()],
    );

    const summary = await backfillCiRuns(db.port);

    expect(db.writes).toEqual({ create: 0, update: 0, link: 1 });
    expect(summary).toMatchObject({ ciRunsUpdated: 0, runsLinked: 1 });
  });
});

describe('backfillCiRuns batching', () => {
  it('never reads or writes more than one batch with 2.5 batches of rows', async () => {
    const db = fakeDb([
      ...[10, 11, 12, 13].map((m, i) =>
        stored(`r0${i}`, `gha-900-job${i}-junit-xml-ab12cd34`, m),
      ),
      ...[8, 6, 7, 5].map((m, i) =>
        stored(`r1${i}`, `gha-901-job${i}-junit-xml-ab12cd34`, m),
      ),
      stored('r20', 'gha-902-job0-junit-xml-ab12cd34', 20),
      stored('r21', 'gha-902-job1-junit-xml-ab12cd34', 21),
    ]);

    const summary = await backfillCiRuns(db.port, { batchSize: 4 });

    expect(db.reads).toEqual([4, 4, 2, 0]);
    expect(db.linkSizes).toEqual([4, 4, 2]);
    expect(summary).toMatchObject({
      scanned: 10,
      ciRunsCreated: 3,
      runsLinked: 10,
    });
  });

  it('merges the time range of a CiRun that spans batches', async () => {
    const db = fakeDb([
      ...[10, 11, 12, 13].map((m, i) =>
        stored(`r0${i}`, `gha-900-job${i}-junit-xml-ab12cd34`, m),
      ),
      ...[8, 6, 7, 5].map((m, i) =>
        stored(`r1${i}`, `gha-900-job${i + 4}-junit-xml-ab12cd34`, m),
      ),
      stored('r20', 'gha-900-job8-junit-xml-ab12cd34', 20),
      stored('r21', 'gha-900-job9-junit-xml-ab12cd34', 21),
    ]);

    const summary = await backfillCiRuns(db.port, { batchSize: 4 });

    expect(db.ciRuns).toHaveLength(1);
    expect(db.ciRuns[0].startedAt).toEqual(at(5));
    expect(db.ciRuns[0].lastReportedAt).toEqual(at(21));
    expect(summary).toMatchObject({ ciRunsCreated: 1, ciRunsUpdated: 2 });
  });
});
