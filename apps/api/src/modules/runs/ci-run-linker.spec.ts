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
  };

  return { linker: new CiRunLinker(prisma as never), prisma };
}

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

  describe('without a ciRunExternalId', () => {
    it('returns undefined and never touches Prisma when no ci field is sent', async () => {
      const { linker, prisma } = build();

      const result = await linker.resolve(apiKey, body());

      expect(result).toBeUndefined();
      expect(ciRunCalls(prisma)).toEqual([0, 0, 0, 0]);
    });

    it('ignores every other ci field and the commit metadata', async () => {
      const { linker, prisma } = build();

      const result = await linker.resolve(
        apiKey,
        body({ ...fullCi, ciRunExternalId: undefined }),
      );

      expect(result).toBeUndefined();
      expect(ciRunCalls(prisma)).toEqual([0, 0, 0, 0]);
    });
  });

  describe('first ingest of a ci run', () => {
    it('upserts by the project, source and external id unique key without reading first, and returns the id', async () => {
      const { linker, prisma } = build();

      const result = await linker.resolve(apiKey, body(fullCi));

      expect(result).toBe('ci-1');
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

      expect(result).toBe('ci-7');
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
});
