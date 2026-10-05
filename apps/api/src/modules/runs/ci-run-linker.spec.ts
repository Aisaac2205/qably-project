import type { ApiKeyIdentity } from '../api-keys/api-keys.contracts';
import { CiRunLinker } from './ci-run-linker';
import { ingestRunSchema } from './runs.schemas';

const NOW = new Date('2026-10-03T12:00:00.000Z');

const apiKey: ApiKeyIdentity = {
  apiKeyId: 'key-1',
  projectId: 'proj-1',
  organizationId: 'org-1',
};

const fullCi = {
  ciRunExternalId: '900',
  ciJobKey: 'api',
  ciWorkflowName: 'CI',
  ciRunNumber: 42,
  ciRunAttempt: 1,
  ciBranch: 'main',
  ciHeadRef: 'feature/x',
  ciActor: 'ana',
  ciEventName: 'push',
  ciServerUrl: 'https://github.com',
  ciRepository: 'acme/shop',
  commitSha: 'a41f9c2d5e6b7a8c9d0e1f2a3b4c5d6e7f8a9b0c',
  commitMessage: 'fix: retry the checkout call',
  commitAuthor: 'ana',
};

const storedFields = {
  workflowName: 'CI',
  runNumber: 42,
  runAttempt: 1,
  branch: 'main',
  headRef: 'feature/x',
  actor: 'ana',
  eventName: 'push',
  serverUrl: 'https://github.com',
  repository: 'acme/shop',
  commitSha: fullCi.commitSha,
  commitMessage: 'fix: retry the checkout call',
  commitAuthor: 'ana',
};

function body(extra: Record<string, unknown> = {}) {
  return ingestRunSchema.parse({
    externalId: 'gha-900-api-junit-unit-xml-ab12cd34',
    reportExternalId: 'gha-900-api-junit-unit-xml-ab12cd34',
    source: 'github_actions',
    suiteName: 'src/a.test.ts',
    name: 'src/a.test.ts',
    cases: [{ name: 'a1', status: 'pass' }],
    ...extra,
  });
}

function build() {
  const prisma = {
    ciRun: {
      upsert: jest.fn().mockResolvedValue({ id: 'ci-1' }),
      update: jest.fn().mockResolvedValue({ id: 'ci-1' }),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    run: {
      findUnique: jest
        .fn()
        .mockResolvedValue(null as { ciJobKey: string | null } | null),
    },
  };
  const knownJobKeys = {
    forProject: jest.fn().mockResolvedValue([] as string[]),
  };

  return {
    linker: new CiRunLinker(prisma as never, knownJobKeys as never),
    prisma,
    knownJobKeys,
  };
}

function knownKeys(t: ReturnType<typeof build>, ...keys: string[]) {
  t.knownJobKeys.forProject.mockResolvedValue(keys);
}

const unparsableId = {
  externalId: 'ci-run-42',
  reportExternalId: 'ci-run-42',
};

const uniqueKey = (projectId: string, source: string, externalId: string) => ({
  projectId_source_externalId: { projectId, source, externalId },
});

interface UpsertArgs {
  where: unknown;
  create: unknown;
  update: unknown;
  select: unknown;
}

function upsertCall(prisma: ReturnType<typeof build>['prisma'], index = 0) {
  const [args] = prisma.ciRun.upsert.mock.calls[index] as [UpsertArgs];
  return args;
}

function ciRunCalls(prisma: ReturnType<typeof build>['prisma']) {
  return Object.values(prisma.ciRun).map((fn) => fn.mock.calls.length);
}

describe('CiRunLinker.resolve', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('without a ciRunExternalId and an external id that carries none', () => {
    it.each([
      ['an id of another format', unparsableId],
      [
        'a local reporter id',
        {
          externalId: 'gha-local-job-junit-unit-xml-3425dd6f',
          reportExternalId: 'gha-local-job-junit-unit-xml-3425dd6f',
        },
      ],
    ])(
      'returns undefined and never touches Prisma for %s',
      async (_label, ids) => {
        const { linker, prisma, knownJobKeys } = build();

        const result = await linker.resolve(apiKey, body(ids));

        expect(result).toBeUndefined();
        expect(ciRunCalls(prisma)).toEqual([0, 0, 0, 0]);
        expect(knownJobKeys.forProject).not.toHaveBeenCalled();
      },
    );

    it('ignores every other ci field and the commit metadata', async () => {
      const { linker, prisma, knownJobKeys } = build();

      const result = await linker.resolve(
        apiKey,
        body({ ...unparsableId, ...fullCi, ciRunExternalId: undefined }),
      );

      expect(result).toBeUndefined();
      expect(ciRunCalls(prisma)).toEqual([0, 0, 0, 0]);
      expect(knownJobKeys.forProject).not.toHaveBeenCalled();
    });
  });

  describe('first ingest of a ci run', () => {
    it('upserts by the project, source and external id unique key without reading first, and returns the link', async () => {
      const { linker, prisma } = build();

      const result = await linker.resolve(apiKey, body(fullCi));

      expect(result).toEqual({ ciRunId: 'ci-1', ciJobKey: 'api' });
      expect(prisma.ciRun.upsert).toHaveBeenCalledTimes(1);
      expect(upsertCall(prisma).where).toEqual(
        uniqueKey('proj-1', 'github_actions', '900'),
      );
      expect(upsertCall(prisma).select).toEqual({ id: true });
      expect(prisma.ciRun.findFirst).not.toHaveBeenCalled();
      expect(prisma.ciRun.findUnique).not.toHaveBeenCalled();
    });

    it('creates the row for the api key project and organization with the metadata and commit fields, leaving the job key out', async () => {
      const { linker, prisma } = build();

      await linker.resolve(apiKey, body(fullCi));

      expect(upsertCall(prisma).create).toStrictEqual({
        projectId: 'proj-1',
        organizationId: 'org-1',
        source: 'github_actions',
        externalId: '900',
        ...storedFields,
        startedAt: NOW,
        lastReportedAt: NOW,
      });
    });

    it('creates the row with only the identity and the clock when nothing else is sent', async () => {
      const { linker, prisma } = build();

      await linker.resolve(apiKey, body({ ciRunExternalId: '901' }));

      expect(upsertCall(prisma).create).toStrictEqual({
        projectId: 'proj-1',
        organizationId: 'org-1',
        source: 'github_actions',
        externalId: '901',
        startedAt: NOW,
        lastReportedAt: NOW,
      });
    });
  });

  describe('later reports of the same ci run', () => {
    it('advances lastReportedAt and never rewrites startedAt when nothing else is sent', async () => {
      const { linker, prisma } = build();

      await linker.resolve(apiKey, body({ ciRunExternalId: '900' }));

      expect(upsertCall(prisma).update).toStrictEqual({ lastReportedAt: NOW });
    });

    it('overwrites every stored field the report carries', async () => {
      const { linker, prisma } = build();

      await linker.resolve(apiKey, body(fullCi));

      expect(upsertCall(prisma).update).toStrictEqual({
        ...storedFields,
        lastReportedAt: NOW,
      });
    });

    it('leaves out a field the report omits instead of clearing it', async () => {
      const { linker, prisma } = build();

      await linker.resolve(
        apiKey,
        body({
          ciRunExternalId: '900',
          ciWorkflowName: 'CI',
          ciBranch: 'main',
        }),
      );

      expect(upsertCall(prisma).update).toStrictEqual({
        workflowName: 'CI',
        branch: 'main',
        lastReportedAt: NOW,
      });
    });

    it('updates the run attempt when Actions reruns the workflow', async () => {
      const { linker, prisma } = build();

      await linker.resolve(
        apiKey,
        body({ ciRunExternalId: '900', ciRunAttempt: 1 }),
      );
      await linker.resolve(
        apiKey,
        body({ ciRunExternalId: '900', ciRunAttempt: 2 }),
      );

      expect(upsertCall(prisma, 0).update).toStrictEqual({
        runAttempt: 1,
        lastReportedAt: NOW,
      });
      expect(upsertCall(prisma, 1).update).toStrictEqual({
        runAttempt: 2,
        lastReportedAt: NOW,
      });
    });
  });

  describe('isolation between ci runs', () => {
    it('keys the upsert by project and by source', async () => {
      const { linker, prisma } = build();

      await linker.resolve(apiKey, body(fullCi));
      await linker.resolve({ ...apiKey, projectId: 'proj-2' }, body(fullCi));
      await linker.resolve(apiKey, body({ ...fullCi, source: 'api' }));

      expect([0, 1, 2].map((index) => upsertCall(prisma, index).where)).toEqual(
        [
          uniqueKey('proj-1', 'github_actions', '900'),
          uniqueKey('proj-2', 'github_actions', '900'),
          uniqueKey('proj-1', 'api', '900'),
        ],
      );
    });
  });

  describe('losing the creation race', () => {
    it('falls back to a single update by the unique key on the first P2002 and returns its id', async () => {
      const { linker, prisma } = build();
      prisma.ciRun.upsert.mockRejectedValueOnce({ code: 'P2002' });
      prisma.ciRun.update.mockResolvedValueOnce({ id: 'ci-7' });

      const result = await linker.resolve(
        apiKey,
        body({ ciRunExternalId: '900', ciBranch: 'main' }),
      );

      expect(result).toEqual({ ciRunId: 'ci-7' });
      expect(prisma.ciRun.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.ciRun.update).toHaveBeenCalledTimes(1);
      expect(prisma.ciRun.update).toHaveBeenCalledWith({
        where: uniqueKey('proj-1', 'github_actions', '900'),
        data: { branch: 'main', lastReportedAt: NOW },
        select: { id: true },
      });
    });

    it('propagates a second P2002 instead of retrying again', async () => {
      const { linker, prisma } = build();
      const second = { code: 'P2002', marker: 'second' };
      prisma.ciRun.upsert.mockRejectedValueOnce({ code: 'P2002' });
      prisma.ciRun.update.mockRejectedValueOnce(second);

      await expect(linker.resolve(apiKey, body(fullCi))).rejects.toBe(second);
      expect(prisma.ciRun.update).toHaveBeenCalledTimes(1);
    });

    it('propagates any other error from the upsert without falling back', async () => {
      const { linker, prisma } = build();
      const failure = new Error('connection lost');
      prisma.ciRun.upsert.mockRejectedValueOnce(failure);

      await expect(linker.resolve(apiKey, body(fullCi))).rejects.toBe(failure);
      expect(prisma.ciRun.update).not.toHaveBeenCalled();
    });

    it('propagates an error raised by the fallback update', async () => {
      const { linker, prisma } = build();
      const gone = { code: 'P2025' };
      prisma.ciRun.upsert.mockRejectedValueOnce({ code: 'P2002' });
      prisma.ciRun.update.mockRejectedValueOnce(gone);

      await expect(linker.resolve(apiKey, body(fullCi))).rejects.toBe(gone);
    });
  });

  describe('the hot path', () => {
    it('never reads the known job keys when ciRunExternalId is sent, with or without a job key', async () => {
      const t = build();
      knownKeys(t, 'api');

      const withKey = await t.linker.resolve(apiKey, body(fullCi));
      const withoutKey = await t.linker.resolve(
        apiKey,
        body({ ciRunExternalId: '900' }),
      );

      expect(withKey).toEqual({ ciRunId: 'ci-1', ciJobKey: 'api' });
      expect(withoutKey).toEqual({ ciRunId: 'ci-1' });
      expect(t.knownJobKeys.forProject).not.toHaveBeenCalled();
    });

    it('trusts the sent ciRunExternalId over the one in the external id', async () => {
      const { linker, prisma } = build();

      await linker.resolve(
        apiKey,
        body({ ciRunExternalId: '777', ciJobKey: 'web' }),
      );

      expect(upsertCall(prisma).where).toEqual(
        uniqueKey('proj-1', 'github_actions', '777'),
      );
    });
  });

  describe('without a ciRunExternalId but with the run id in the external id', () => {
    const realId = 'gha-900-api-junit-unit-xml-3425dd6f';
    const stale = (extra: Record<string, unknown> = {}) =>
      body({ externalId: realId, reportExternalId: realId, ...extra });

    it('links it to the ci run of that id with the same project and source, as if the id had been sent', async () => {
      const { linker, prisma } = build();

      const result = await linker.resolve(apiKey, stale());

      expect(result).toEqual({ ciRunId: 'ci-1' });
      expect(prisma.ciRun.upsert).toHaveBeenCalledTimes(1);
      expect(upsertCall(prisma).where).toEqual(
        uniqueKey('proj-1', 'github_actions', '900'),
      );
      expect(upsertCall(prisma).create).toStrictEqual({
        projectId: 'proj-1',
        organizationId: 'org-1',
        source: 'github_actions',
        externalId: '900',
        startedAt: NOW,
        lastReportedAt: NOW,
      });
      expect(upsertCall(prisma).update).toStrictEqual({ lastReportedAt: NOW });
    });

    it('keeps the source of the request in the key', async () => {
      const { linker, prisma } = build();

      await linker.resolve(apiKey, stale({ source: 'api' }));

      expect(upsertCall(prisma).where).toEqual(
        uniqueKey('proj-1', 'api', '900'),
      );
    });

    it('reads the id of the run, not the one of the report', async () => {
      const { linker, prisma } = build();

      await linker.resolve(
        apiKey,
        body({
          externalId: 'gha-901-web-junit-unit-xml-3425dd6f',
          reportExternalId: realId,
        }),
      );

      expect(upsertCall(prisma).where).toEqual(
        uniqueKey('proj-1', 'github_actions', '901'),
      );
    });

    it('still writes the other ci fields and the commit metadata the request carries', async () => {
      const { linker, prisma } = build();

      await linker.resolve(
        apiKey,
        stale({ ...fullCi, ciRunExternalId: undefined, ciJobKey: undefined }),
      );

      expect(upsertCall(prisma).create).toStrictEqual({
        projectId: 'proj-1',
        organizationId: 'org-1',
        source: 'github_actions',
        externalId: '900',
        ...storedFields,
        startedAt: NOW,
        lastReportedAt: NOW,
      });
    });

    it('uses the job key the request carries and skips the lookup', async () => {
      const t = build();
      knownKeys(t, 'web');

      const result = await t.linker.resolve(apiKey, stale({ ciJobKey: 'api' }));

      expect(result).toEqual({ ciRunId: 'ci-1', ciJobKey: 'api' });
      expect(t.knownJobKeys.forProject).not.toHaveBeenCalled();
    });

    it('resolves the job key from the known keys of the project of the api key', async () => {
      const t = build();
      knownKeys(t, 'web', 'api');

      const result = await t.linker.resolve(
        { ...apiKey, projectId: 'proj-2' },
        stale(),
      );

      expect(result).toEqual({ ciRunId: 'ci-1', ciJobKey: 'api' });
      expect(t.knownJobKeys.forProject).toHaveBeenCalledTimes(1);
      expect(t.knownJobKeys.forProject).toHaveBeenCalledWith('proj-2');
    });

    it('links the run without a job key when no known key matches its id', async () => {
      const t = build();
      knownKeys(t, 'web', 'landing');

      const result = await t.linker.resolve(apiKey, stale());

      expect(result).toEqual({ ciRunId: 'ci-1' });
    });

    it('links the run without a job key when the project has no known key', async () => {
      const t = build();
      knownKeys(t);

      const result = await t.linker.resolve(apiKey, stale());

      expect(result).toEqual({ ciRunId: 'ci-1' });
    });

    it('prefers the longest known key over a shorter prefix of it', async () => {
      const t = build();
      knownKeys(t, 'build', 'build-web');
      const id = 'gha-900-build-web-junit-unit-xml-3425dd6f';

      const result = await t.linker.resolve(
        apiKey,
        body({ externalId: id, reportExternalId: id }),
      );

      expect(result).toEqual({ ciRunId: 'ci-1', ciJobKey: 'build-web' });
    });

    it('falls back to a single update on the first P2002 and returns the resolved link', async () => {
      const t = build();
      knownKeys(t, 'api');
      t.prisma.ciRun.upsert.mockRejectedValueOnce({ code: 'P2002' });
      t.prisma.ciRun.update.mockResolvedValueOnce({ id: 'ci-7' });

      const result = await t.linker.resolve(apiKey, stale());

      expect(result).toEqual({ ciRunId: 'ci-7', ciJobKey: 'api' });
      expect(t.prisma.ciRun.update).toHaveBeenCalledWith({
        where: uniqueKey('proj-1', 'github_actions', '900'),
        data: { lastReportedAt: NOW },
        select: { id: true },
      });
    });

    it('fails before writing the ci run when the known keys cannot be read', async () => {
      const t = build();
      const failure = new Error('connection lost');
      t.knownJobKeys.forProject.mockRejectedValueOnce(failure);

      await expect(t.linker.resolve(apiKey, stale())).rejects.toBe(failure);
      expect(ciRunCalls(t.prisma)).toEqual([0, 0, 0, 0]);
    });
  });

  describe('a job key resolved from the external id', () => {
    const realId = 'gha-900-web-e2e-junit-xml-3425dd6f';
    const stale = (extra: Record<string, unknown> = {}) =>
      body({ externalId: realId, reportExternalId: realId, ...extra });
    const knowingWeb = () => {
      const t = build();
      knownKeys(t, 'web');
      return t;
    };

    it('is returned when the run is not stored yet', async () => {
      const t = knowingWeb();

      const result = await t.linker.resolve(apiKey, stale());

      expect(result).toEqual({ ciRunId: 'ci-1', ciJobKey: 'web' });
    });

    it('is returned when the stored run has no job key, which fills it', async () => {
      const t = knowingWeb();
      t.prisma.run.findUnique.mockResolvedValue({ ciJobKey: null });

      const result = await t.linker.resolve(apiKey, stale());

      expect(result).toEqual({ ciRunId: 'ci-1', ciJobKey: 'web' });
    });

    it('is left out when the stored run already has a job key, so a re-ingest never overwrites it', async () => {
      const t = knowingWeb();
      t.prisma.run.findUnique.mockResolvedValue({ ciJobKey: 'web-e2e' });

      const result = await t.linker.resolve(apiKey, stale());

      expect(result).toEqual({ ciRunId: 'ci-1' });
    });

    it('looks the stored run up by the unique key of the request, selecting only the job key', async () => {
      const t = knowingWeb();

      await t.linker.resolve({ ...apiKey, projectId: 'proj-2' }, stale());

      expect(t.prisma.run.findUnique).toHaveBeenCalledTimes(1);
      expect(t.prisma.run.findUnique).toHaveBeenCalledWith({
        where: uniqueKey('proj-2', 'github_actions', realId),
        select: { ciJobKey: true },
      });
    });

    it('keeps the source of the request in the lookup', async () => {
      const t = knowingWeb();

      await t.linker.resolve(apiKey, stale({ source: 'api' }));

      expect(t.prisma.run.findUnique).toHaveBeenCalledWith({
        where: uniqueKey('proj-1', 'api', realId),
        select: { ciJobKey: true },
      });
    });

    it('is not looked up against the stored run when no known key matches the id', async () => {
      const t = build();
      knownKeys(t, 'landing');

      const result = await t.linker.resolve(apiKey, stale());

      expect(result).toEqual({ ciRunId: 'ci-1' });
      expect(t.prisma.run.findUnique).not.toHaveBeenCalled();
    });

    it('fails before writing the ci run when the stored run cannot be read', async () => {
      const t = knowingWeb();
      const failure = new Error('connection lost');
      t.prisma.run.findUnique.mockRejectedValueOnce(failure);

      await expect(t.linker.resolve(apiKey, stale())).rejects.toBe(failure);
      expect(ciRunCalls(t.prisma)).toEqual([0, 0, 0, 0]);
    });
  });

  describe('a job key the request carries', () => {
    const realId = 'gha-900-web-e2e-junit-xml-3425dd6f';

    it('is returned over a stored one without reading the stored run, so the reporter keeps overwriting', async () => {
      const t = build();
      knownKeys(t, 'web');
      t.prisma.run.findUnique.mockResolvedValue({ ciJobKey: 'web' });

      const result = await t.linker.resolve(
        apiKey,
        body({
          externalId: realId,
          reportExternalId: realId,
          ciJobKey: 'web-e2e',
        }),
      );

      expect(result).toEqual({ ciRunId: 'ci-1', ciJobKey: 'web-e2e' });
      expect(t.prisma.run.findUnique).not.toHaveBeenCalled();
    });

    it('is returned over a stored one when the request also carries the ciRunExternalId', async () => {
      const t = build();
      t.prisma.run.findUnique.mockResolvedValue({ ciJobKey: 'web' });

      const result = await t.linker.resolve(apiKey, body(fullCi));

      expect(result).toEqual({ ciRunId: 'ci-1', ciJobKey: 'api' });
      expect(t.prisma.run.findUnique).not.toHaveBeenCalled();
    });
  });
});
