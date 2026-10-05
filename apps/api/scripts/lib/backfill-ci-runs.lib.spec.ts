import {
  MAX_MERGE_ATTEMPTS,
  backfillCiRuns,
  type BackfillPort,
  type BackfillRunRow,
  type NewCiRun,
} from './backfill-ci-runs.lib';

interface StoredRun extends BackfillRunRow {
  ciRunId: string | null;
  ciJobKey: string | null;
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
    ciJobKey: null,
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

const sameKey = (
  row: Pick<StoredCiRun, 'projectId' | 'source' | 'externalId'>,
  key: Pick<StoredCiRun, 'projectId' | 'source' | 'externalId'>,
) =>
  row.projectId === key.projectId &&
  row.source === key.source &&
  row.externalId === key.externalId;

interface FakeHooks {
  afterFind?: (row: StoredCiRun, finds: number) => void;
  beforeCreate?: (input: NewCiRun, ciRuns: StoredCiRun[]) => void;
}

const uniqueViolation = () =>
  Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

function fakeDb(
  runs: StoredRun[],
  ciRuns: StoredCiRun[] = [],
  hooks: FakeHooks = {},
) {
  const reads: number[] = [];
  const linkSizes: number[] = [];
  const writes = { create: 0, update: 0, link: 0 };
  const counters = { finds: 0 };
  const events: string[] = [];

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
      events.push(`read:${page.length}`);
      return Promise.resolve(page);
    },
    findCiRun: (key) => {
      counters.finds += 1;
      const row = ciRuns.find((candidate) => sameKey(candidate, key));
      if (row === undefined) return Promise.resolve(null);

      const snapshot = {
        id: row.id,
        startedAt: row.startedAt,
        lastReportedAt: row.lastReportedAt,
        commitSha: row.commitSha ?? null,
        commitMessage: row.commitMessage ?? null,
        commitAuthor: row.commitAuthor ?? null,
      };
      hooks.afterFind?.(row, counters.finds);
      return Promise.resolve(snapshot);
    },
    createCiRun: (input) => {
      hooks.beforeCreate?.(input, ciRuns);
      if (ciRuns.some((candidate) => sameKey(candidate, input))) {
        return Promise.reject(uniqueViolation());
      }
      const id = `ci-${ciRuns.length + 1}`;
      ciRuns.push({ ...input, id });
      writes.create += 1;
      events.push('create');
      return Promise.resolve(id);
    },
    updateCiRunIfUnchanged: (expected, patch) => {
      const row = ciRuns.find((candidate) => candidate.id === expected.id);
      const unchanged =
        row !== undefined &&
        row.startedAt.getTime() === expected.startedAt.getTime() &&
        row.lastReportedAt.getTime() === expected.lastReportedAt.getTime() &&
        (row.commitSha ?? null) === expected.commitSha &&
        (row.commitMessage ?? null) === expected.commitMessage &&
        (row.commitAuthor ?? null) === expected.commitAuthor;
      if (!unchanged) return Promise.resolve(false);

      Object.assign(row, patch);
      writes.update += 1;
      events.push('update');
      return Promise.resolve(true);
    },
    linkRuns: (ciRunId, runIds) => {
      linkSizes.push(runIds.length);
      events.push(`link:${runIds.length}`);
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
    readKnownJobKeys: (projectId) =>
      Promise.resolve([
        ...new Set(
          runs.flatMap((run) =>
            run.projectId === projectId && run.ciJobKey !== null
              ? [run.ciJobKey]
              : [],
          ),
        ),
      ]),
    readRunsMissingJobKey: (afterId, take) => {
      const page = runs
        .filter(
          (run) =>
            run.ciRunId !== null &&
            run.ciJobKey === null &&
            run.externalId?.startsWith('gha-') === true &&
            (afterId === undefined || run.id > afterId),
        )
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .slice(0, take)
        .flatMap((run) => {
          const ciRun = ciRuns.find(
            (candidate) => candidate.id === run.ciRunId,
          );
          return ciRun === undefined
            ? []
            : [
                {
                  id: run.id,
                  projectId: run.projectId,
                  externalId: run.externalId,
                  ciRunExternalId: ciRun.externalId,
                },
              ];
        });
      return Promise.resolve(page);
    },
    setJobKey: (runIds, ciJobKey) => {
      let changed = 0;
      for (const run of runs) {
        if (
          runIds.includes(run.id) &&
          run.ciJobKey === null &&
          run.ciRunId !== null
        ) {
          run.ciJobKey = ciJobKey;
          changed += 1;
        }
      }
      return Promise.resolve(changed);
    },
  };

  return { port, runs, ciRuns, reads, linkSizes, writes, counters, events };
}

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
      jobKeysSet: 0,
      jobKeysUnresolved: 3,
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

  it('takes each commit field from the first Run, in ascending id order, that carries it', async () => {
    const db = fakeDb([
      stored('r1', 'gha-900-api-junit-xml-ab12cd34', 20, {
        commitSha: 'sha-first',
        commitAuthor: 'ana',
      }),
      stored('r2', 'gha-900-web-junit-xml-cd34ef56', 10, {
        commitSha: 'sha-second',
        commitMessage: 'message-second',
        commitAuthor: 'bob',
      }),
      stored('r3', 'gha-900-landing-junit-xml-ef56ab78', 15, {
        commitSha: 'sha-third',
        commitMessage: 'message-third',
      }),
    ]);

    await backfillCiRuns(db.port);

    expect(db.ciRuns[0]).toMatchObject({
      commitSha: 'sha-first',
      commitMessage: 'message-second',
      commitAuthor: 'ana',
    });
  });

  it('keeps the commit fields written by an earlier batch and fills only the ones it left empty', async () => {
    const db = fakeDb([
      stored('r1', 'gha-900-api-junit-xml-ab12cd34', 10, {
        commitSha: 'sha-batch-1',
      }),
      stored('r2', 'gha-900-web-junit-xml-cd34ef56', 11),
      stored('r3', 'gha-900-landing-junit-xml-ef56ab78', 12, {
        commitSha: 'sha-batch-2',
        commitMessage: 'message-batch-2',
      }),
    ]);

    await backfillCiRuns(db.port, { batchSize: 2 });

    expect(db.ciRuns[0]).toMatchObject({
      commitSha: 'sha-batch-1',
      commitMessage: 'message-batch-2',
    });
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
      jobKeysSet: 0,
      jobKeysUnresolved: 1,
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
      jobKeysSet: 0,
      jobKeysUnresolved: 2,
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

describe('backfillCiRuns against a CiRun that already holds the same times', () => {
  it('does not write when the group ends exactly at the stored lastReportedAt', async () => {
    const db = fakeDb(
      [stored('r1', 'gha-900-api-junit-xml-ab12cd34', 31)],
      [liveCiRun()],
    );

    const summary = await backfillCiRuns(db.port);

    expect(db.writes).toEqual({ create: 0, update: 0, link: 1 });
    expect(summary).toMatchObject({ ciRunsUpdated: 0, runsLinked: 1 });
    expect(db.ciRuns[0].lastReportedAt).toEqual(at(31));
  });

  it('does not write when the group spans exactly the stored startedAt and lastReportedAt', async () => {
    const db = fakeDb(
      [
        stored('r1', 'gha-900-api-junit-xml-ab12cd34', 30),
        stored('r2', 'gha-900-web-junit-xml-cd34ef56', 31),
      ],
      [liveCiRun()],
    );

    const summary = await backfillCiRuns(db.port);

    expect(db.writes).toEqual({ create: 0, update: 0, link: 2 });
    expect(summary).toMatchObject({ ciRunsUpdated: 0, runsLinked: 2 });
  });
});

describe('backfillCiRuns against concurrent live ingestion', () => {
  it('never overwrites a lastReportedAt that a live ingest advanced after the read', async () => {
    const db = fakeDb(
      [stored('r1', 'gha-900-api-junit-xml-ab12cd34', 45)],
      [liveCiRun()],
      {
        afterFind: (row, finds) => {
          if (finds === 1) row.lastReportedAt = at(50);
        },
      },
    );

    const summary = await backfillCiRuns(db.port);

    expect(db.ciRuns[0].lastReportedAt).toEqual(at(50));
    expect(db.runs[0].ciRunId).toBe('ci-live');
    expect(summary).toMatchObject({ ciRunsUpdated: 0, runsLinked: 1 });
  });

  it('never overwrites a commit field that a live ingest filled after the read', async () => {
    const db = fakeDb(
      [
        stored('r1', 'gha-900-api-junit-xml-ab12cd34', 30, {
          commitSha: 'backfill-sha',
        }),
      ],
      [liveCiRun()],
      {
        afterFind: (row, finds) => {
          if (finds === 1) row.commitSha = 'live-sha';
        },
      },
    );

    await backfillCiRuns(db.port);

    expect(db.ciRuns[0].commitSha).toBe('live-sha');
    expect(db.runs[0].ciRunId).toBe('ci-live');
  });

  it('merges into the CiRun that a live ingest created between the read and the create', async () => {
    const db = fakeDb([stored('r1', 'gha-900-api-junit-xml-ab12cd34', 5)], [], {
      beforeCreate: (_input, ciRuns) => {
        if (ciRuns.length === 0) ciRuns.push(liveCiRun());
      },
    });

    const summary = await backfillCiRuns(db.port);

    expect(db.ciRuns).toHaveLength(1);
    expect(db.ciRuns[0]).toMatchObject({ id: 'ci-live', startedAt: at(5) });
    expect(db.ciRuns[0].lastReportedAt).toEqual(at(31));
    expect(db.runs[0].ciRunId).toBe('ci-live');
    expect(summary).toEqual({
      scanned: 1,
      unattributable: 0,
      ciRunsCreated: 0,
      ciRunsUpdated: 1,
      runsLinked: 1,
      jobKeysSet: 0,
      jobKeysUnresolved: 1,
    });
  });

  it('recomputes the merge from a fresh read when the row changed and applies it', async () => {
    const db = fakeDb(
      [stored('r1', 'gha-900-api-junit-xml-ab12cd34', 5)],
      [liveCiRun()],
      {
        afterFind: (row, finds) => {
          if (finds === 1) row.lastReportedAt = at(50);
        },
      },
    );

    const summary = await backfillCiRuns(db.port);

    expect(db.counters.finds).toBe(2);
    expect(db.ciRuns[0].startedAt).toEqual(at(5));
    expect(db.ciRuns[0].lastReportedAt).toEqual(at(50));
    expect(db.runs[0].ciRunId).toBe('ci-live');
    expect(summary).toMatchObject({ ciRunsUpdated: 1, runsLinked: 1 });
    expect(db.writes.update).toBe(1);
  });

  it('gives up loudly after a bounded number of attempts and links nothing', async () => {
    const db = fakeDb(
      [stored('r1', 'gha-900-api-junit-xml-ab12cd34', 5)],
      [liveCiRun()],
      {
        afterFind: (row, finds) => {
          row.lastReportedAt = at(40 + finds);
        },
      },
    );

    await expect(backfillCiRuns(db.port)).rejects.toThrow(
      `after ${MAX_MERGE_ATTEMPTS} attempts`,
    );

    expect(db.counters.finds).toBe(MAX_MERGE_ATTEMPTS);
    expect(db.writes).toEqual({ create: 0, update: 0, link: 0 });
    expect(db.runs[0].ciRunId).toBeNull();
  });

  it('gives up loudly when the create keeps hitting a unique violation', async () => {
    const db = fakeDb([stored('r1', 'gha-900-api-junit-xml-ab12cd34', 5)], [], {
      beforeCreate: () => {
        throw uniqueViolation();
      },
    });

    await expect(backfillCiRuns(db.port)).rejects.toThrow(
      `after ${MAX_MERGE_ATTEMPTS} attempts`,
    );

    expect(db.counters.finds).toBe(MAX_MERGE_ATTEMPTS);
    expect(db.runs[0].ciRunId).toBeNull();
  });

  it.each([
    ['a connection error', new Error('connection lost')],
    [
      'a foreign key violation',
      Object.assign(new Error('Foreign key constraint failed'), {
        code: 'P2003',
      }),
    ],
  ])('lets %s on create abort the run', async (_label, error) => {
    const db = fakeDb([stored('r1', 'gha-900-api-junit-xml-ab12cd34', 5)], [], {
      beforeCreate: () => {
        throw error;
      },
    });

    await expect(backfillCiRuns(db.port)).rejects.toBe(error);
    expect(db.runs[0].ciRunId).toBeNull();
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
    expect(db.events).toEqual([
      'read:4',
      'create',
      'link:4',
      'read:4',
      'create',
      'link:4',
      'read:2',
      'create',
      'link:2',
      'read:0',
    ]);
    expect(summary).toMatchObject({
      scanned: 10,
      ciRunsCreated: 3,
      runsLinked: 10,
    });
  });

  it('writes every group of a batch before it reads the next batch', async () => {
    const db = fakeDb([
      stored('r00', 'gha-900-api-junit-xml-ab12cd34', 10),
      stored('r01', 'gha-900-web-junit-xml-cd34ef56', 11),
      stored('r02', 'gha-901-api-junit-xml-ab12cd34', 6),
      stored('r03', 'gha-901-web-junit-xml-cd34ef56', 7),
      stored('r10', 'gha-901-landing-junit-xml-ef56ab78', 3),
      stored('r11', 'gha-local-job-junit-xml-ab12cd34', 4),
      stored('r12', 'gha-902-api-junit-xml-ab12cd34', 20),
    ]);

    await backfillCiRuns(db.port, { batchSize: 4 });

    expect(db.events).toEqual([
      'read:4',
      'create',
      'link:2',
      'create',
      'link:2',
      'read:3',
      'update',
      'link:1',
      'create',
      'link:1',
      'read:0',
    ]);
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

describe('backfillCiRuns job key recovery', () => {
  const live = (extra: Partial<StoredRun> = {}) =>
    stored('r-live', 'gha-901-api-junit-xml-ab12cd34', 40, {
      ciRunId: 'ci-901',
      ciJobKey: 'api',
      ...extra,
    });
  const ci901 = () => liveCiRun({ id: 'ci-901', externalId: '901' });

  it('sets the job key of the runs it links when the project already uses that key', async () => {
    const db = fakeDb(
      [
        live(),
        stored('r1', 'gha-900-api-junit-unit-xml-3425dd6f', 10),
        stored('r2', 'gha-900-landing-junit-xml-ef56ab78', 11),
      ],
      [ci901()],
    );

    const summary = await backfillCiRuns(db.port);

    expect(db.runs.map((run) => [run.id, run.ciJobKey])).toEqual([
      ['r-live', 'api'],
      ['r1', 'api'],
      ['r2', null],
    ]);
    expect(summary).toMatchObject({
      runsLinked: 2,
      jobKeysSet: 1,
      jobKeysUnresolved: 1,
    });
  });

  it('sets the job key of a run that was linked earlier without one, in a CiRun with nothing left to link', async () => {
    const db = fakeDb(
      [
        live(),
        stored('r-old', 'gha-899-api-junit-xml-ab12cd34', 5, {
          ciRunId: 'ci-899',
        }),
      ],
      [ci901(), liveCiRun({ id: 'ci-899', externalId: '899' })],
    );

    const summary = await backfillCiRuns(db.port);

    expect(db.runs[1].ciJobKey).toBe('api');
    expect(summary).toMatchObject({
      scanned: 0,
      runsLinked: 0,
      jobKeysSet: 1,
      jobKeysUnresolved: 0,
    });
  });

  it('never gives a job key to a run that is not linked', async () => {
    const db = fakeDb([
      live(),
      stored('r1', 'gha-900-api-junit-xml-ab12cd34', 10),
      stored('r2', 'gha-local-job-junit-xml-ab12cd34', 11),
    ]);

    await backfillCiRuns(db.port);

    expect(db.runs[2].ciRunId).toBeNull();
    expect(db.runs[2].ciJobKey).toBeNull();
  });

  it('never overwrites a job key that a run already has', async () => {
    const db = fakeDb(
      [
        live(),
        stored('r1', 'gha-901-web-junit-xml-cd34ef56', 10, {
          ciRunId: 'ci-901',
          ciJobKey: 'api',
        }),
      ],
      [ci901()],
    );

    const summary = await backfillCiRuns(db.port);

    expect(db.runs[1].ciJobKey).toBe('api');
    expect(summary.jobKeysSet).toBe(0);
  });

  it('writes nothing on a second pass and reports the same unresolved count', async () => {
    const db = fakeDb(
      [
        live(),
        stored('r1', 'gha-900-api-junit-xml-ab12cd34', 10),
        stored('r2', 'gha-900-landing-junit-xml-ef56ab78', 11),
      ],
      [ci901()],
    );

    const first = await backfillCiRuns(db.port);
    const second = await backfillCiRuns(db.port);

    expect(first).toMatchObject({ jobKeysSet: 1, jobKeysUnresolved: 1 });
    expect(second).toMatchObject({
      runsLinked: 0,
      jobKeysSet: 0,
      jobKeysUnresolved: 1,
    });
  });
});
