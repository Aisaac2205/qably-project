import { Logger } from '@nestjs/common';
import { DOMAIN_EVENTS } from '../../common/events/domain-events';
import { IngestionProcessor } from './ingestion.processor';

interface FakePrisma {
  scmEvent: { findUnique: jest.Mock; update: jest.Mock };
  ingestionBatch: { create: jest.Mock };
}

interface StoredCommit {
  sha: string;
  position: number;
  attributedFiles: string[];
}

const TIP = 'a'.repeat(40);

const defaultEvent = {
  id: 'event-1',
  organizationId: 'org-1',
  provider: 'GITHUB',
  repo: 'acme/shop',
  branch: 'main',
  defaultBranch: 'main' as string | null,
  commitSha: TIP,
  changedFiles: ['src/cart.spec.ts', 'src/cart.ts'],
  commits: [] as StoredCommit[],
  connection: {
    projects: [{ id: 'proj-1', testFilePatterns: ['*.spec.ts', '*.test.ts'] }],
  },
};

function createPrisma(event: unknown = defaultEvent): FakePrisma {
  return {
    scmEvent: {
      findUnique: jest.fn().mockResolvedValue(event),
      update: jest.fn().mockResolvedValue({}),
    },
    ingestionBatch: {
      create: jest.fn().mockResolvedValue({ codeChanges: [] }),
    },
  };
}

interface BatchCreateArgument {
  data: {
    project: { connect: { id: string } };
    scmEvent: { connect: { id: string } };
    source: string;
    status: string;
    codeChanges: {
      create: Array<{
        filePath: string;
        commitSha: string;
        detectedPattern: string | null;
        evidence: { create: Record<string, unknown> };
      }>;
    };
  };
}

function batchCalls(prisma: FakePrisma): BatchCreateArgument[] {
  return prisma.ingestionBatch.create.mock.calls.map(
    ([argument]: [BatchCreateArgument]) => argument,
  );
}

function job(scmEventId: string) {
  return { data: { scmEventId } } as never;
}

function createEvents() {
  return { publish: jest.fn() };
}

function createExtraction() {
  return { enqueueCodeChanges: jest.fn().mockResolvedValue(0) };
}

describe('IngestionProcessor', () => {
  it('marks the event processed once the job completes', async () => {
    const prisma = createPrisma();

    await new IngestionProcessor(
      prisma as never,
      createEvents() as never,
      createExtraction() as never,
    ).process(job('event-1'));

    expect(prisma.scmEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { status: 'PROCESSED' },
    });
  });

  it('records one batch per project hanging off the connection', async () => {
    const prisma = createPrisma({
      ...defaultEvent,
      connection: {
        projects: [
          { id: 'proj-1', testFilePatterns: ['*.spec.ts'] },
          { id: 'proj-2', testFilePatterns: ['*.spec.ts'] },
        ],
      },
    });

    await new IngestionProcessor(
      prisma as never,
      createEvents() as never,
      createExtraction() as never,
    ).process(job('event-1'));

    expect(prisma.ingestionBatch.create).toHaveBeenCalledTimes(2);
    expect(
      batchCalls(prisma).map((call) => call.data.project.connect.id),
    ).toEqual(['proj-1', 'proj-2']);
  });

  it('persists every changed file and flags only the ones matching a declared pattern', async () => {
    const prisma = createPrisma();

    await new IngestionProcessor(
      prisma as never,
      createEvents() as never,
      createExtraction() as never,
    ).process(job('event-1'));

    const [{ data }] = batchCalls(prisma);

    expect(data.source).toBe('WEBHOOK');
    expect(data.status).toBe('COMPLETED');
    expect(data.scmEvent.connect.id).toBe('event-1');
    expect(data.codeChanges.create).toEqual([
      expect.objectContaining({
        filePath: 'src/cart.spec.ts',
        commitSha: 'a'.repeat(40),
        detectedPattern: '*.spec.ts',
      }),
      expect.objectContaining({
        filePath: 'src/cart.ts',
        detectedPattern: null,
      }),
    ]);
  });

  it('attaches source evidence pointing at the file on the pushed commit', async () => {
    const prisma = createPrisma();

    await new IngestionProcessor(
      prisma as never,
      createEvents() as never,
      createExtraction() as never,
    ).process(job('event-1'));

    const [{ data }] = batchCalls(prisma);

    expect(data.codeChanges.create[0].evidence.create).toEqual({
      project: { connect: { id: 'proj-1' } },
      kind: 'SOURCE_EXCERPT',
      title: 'src/cart.spec.ts',
      uri: `https://github.com/acme/shop/blob/${'a'.repeat(40)}/src/cart.spec.ts`,
    });
  });

  describe('commit of each code change', () => {
    const first = '1'.repeat(40);
    const second = '2'.repeat(40);

    async function recordedCommits(event: unknown) {
      const prisma = createPrisma(event);

      await new IngestionProcessor(
        prisma as never,
        createEvents() as never,
        createExtraction() as never,
      ).process(job('event-1'));

      return batchCalls(prisma).map((call) =>
        call.data.codeChanges.create.map(({ filePath, commitSha }) => [
          filePath,
          commitSha,
        ]),
      );
    }

    it('loads the stored commits of the event with only the columns it needs, oldest first', async () => {
      const prisma = createPrisma();

      await new IngestionProcessor(
        prisma as never,
        createEvents() as never,
        createExtraction() as never,
      ).process(job('event-1'));

      const [[query]] = prisma.scmEvent.findUnique.mock.calls as [
        [{ where: unknown; select: { commits: unknown } }],
      ];

      expect(query.where).toEqual({ id: 'event-1' });
      expect(query.select.commits).toEqual({
        select: { sha: true, position: true, attributedFiles: true },
        orderBy: { position: 'asc' },
      });
    });

    it('gives each code change the last commit of the push that touched its file', async () => {
      const [calls] = await recordedCommits({
        ...defaultEvent,
        commits: [
          { sha: first, position: 0, attributedFiles: ['src/cart.spec.ts'] },
          { sha: second, position: 1, attributedFiles: ['src/cart.ts'] },
        ],
      });

      expect(calls).toEqual([
        ['src/cart.spec.ts', first],
        ['src/cart.ts', second],
      ]);
    });

    it('prefers the later commit when several commits touched the same file', async () => {
      const [calls] = await recordedCommits({
        ...defaultEvent,
        commits: [
          {
            sha: first,
            position: 0,
            attributedFiles: ['src/cart.spec.ts', 'src/cart.ts'],
          },
          { sha: second, position: 1, attributedFiles: ['src/cart.spec.ts'] },
        ],
      });

      expect(calls).toEqual([
        ['src/cart.spec.ts', second],
        ['src/cart.ts', first],
      ]);
    });

    it('keeps the tip sha for a file no stored commit lists', async () => {
      const [calls] = await recordedCommits({
        ...defaultEvent,
        commits: [
          { sha: first, position: 0, attributedFiles: ['src/other.ts'] },
        ],
      });

      expect(calls).toEqual([
        ['src/cart.spec.ts', TIP],
        ['src/cart.ts', TIP],
      ]);
    });

    it('keeps the tip sha for events stored before commits carried attributed files', async () => {
      const [calls] = await recordedCommits({
        ...defaultEvent,
        commits: [
          { sha: first, position: 0, attributedFiles: [] },
          { sha: second, position: 1, attributedFiles: [] },
        ],
      });

      expect(calls).toEqual([
        ['src/cart.spec.ts', TIP],
        ['src/cart.ts', TIP],
      ]);
    });

    it('keeps the tip sha when the provider reported no commits', async () => {
      const [calls] = await recordedCommits({ ...defaultEvent, commits: [] });

      expect(calls).toEqual([
        ['src/cart.spec.ts', TIP],
        ['src/cart.ts', TIP],
      ]);
    });

    it('mixes both: attributed files get their commit and the rest keep the tip', async () => {
      const [calls] = await recordedCommits({
        ...defaultEvent,
        changedFiles: ['src/a.spec.ts', 'src/b.spec.ts', 'src/c.spec.ts'],
        commits: [
          { sha: first, position: 0, attributedFiles: ['src/a.spec.ts'] },
          { sha: second, position: 1, attributedFiles: ['src/c.spec.ts'] },
        ],
      });

      expect(calls).toEqual([
        ['src/a.spec.ts', first],
        ['src/b.spec.ts', TIP],
        ['src/c.spec.ts', second],
      ]);
    });

    it('creates code changes only for the changed files, not for every file attributed to a commit', async () => {
      const [calls] = await recordedCommits({
        ...defaultEvent,
        changedFiles: ['src/cart.spec.ts'],
        commits: [
          {
            sha: first,
            position: 0,
            attributedFiles: ['src/cart.spec.ts', 'src/removed.spec.ts'],
          },
        ],
      });

      expect(calls).toEqual([['src/cart.spec.ts', first]]);
    });

    it('applies the same attribution to every project of the connection', async () => {
      const calls = await recordedCommits({
        ...defaultEvent,
        commits: [
          { sha: first, position: 0, attributedFiles: ['src/cart.ts'] },
        ],
        connection: {
          projects: [
            { id: 'proj-1', testFilePatterns: ['*.spec.ts'] },
            { id: 'proj-2', testFilePatterns: ['*.spec.ts'] },
          ],
        },
      });

      expect(calls).toEqual([
        [
          ['src/cart.spec.ts', TIP],
          ['src/cart.ts', first],
        ],
        [
          ['src/cart.spec.ts', TIP],
          ['src/cart.ts', first],
        ],
      ]);
    });

    it('keeps the source evidence on the pushed tip, which holds the same file content', async () => {
      const prisma = createPrisma({
        ...defaultEvent,
        commits: [
          { sha: first, position: 0, attributedFiles: ['src/cart.spec.ts'] },
        ],
      });

      await new IngestionProcessor(
        prisma as never,
        createEvents() as never,
        createExtraction() as never,
      ).process(job('event-1'));

      const [{ data }] = batchCalls(prisma);

      expect(data.codeChanges.create[0].commitSha).toBe(first);
      expect(data.codeChanges.create[0].evidence.create).toEqual(
        expect.objectContaining({
          uri: `https://github.com/acme/shop/blob/${TIP}/src/cart.spec.ts`,
        }),
      );
    });
  });

  it('records no batch when the event carries no changed files', async () => {
    const prisma = createPrisma({ ...defaultEvent, changedFiles: [] });

    await new IngestionProcessor(
      prisma as never,
      createEvents() as never,
      createExtraction() as never,
    ).process(job('event-1'));

    expect(prisma.ingestionBatch.create).not.toHaveBeenCalled();
    expect(prisma.scmEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { status: 'PROCESSED' },
    });
  });

  it('records no batch when no project hangs off the connection', async () => {
    const prisma = createPrisma({
      ...defaultEvent,
      connection: { projects: [] },
    });

    await new IngestionProcessor(
      prisma as never,
      createEvents() as never,
      createExtraction() as never,
    ).process(job('event-1'));

    expect(prisma.ingestionBatch.create).not.toHaveBeenCalled();
  });

  it('marks the event failed and rethrows when processing breaks', async () => {
    const prisma = createPrisma();
    const failure = new Error('downstream unavailable');
    prisma.ingestionBatch.create.mockRejectedValueOnce(failure);

    await expect(
      new IngestionProcessor(
        prisma as never,
        createEvents() as never,
        createExtraction() as never,
      ).process(job('event-2')),
    ).rejects.toThrow(failure);

    expect(prisma.scmEvent.update).toHaveBeenLastCalledWith({
      where: { id: 'event-2' },
      data: { status: 'FAILED' },
    });
  });

  it('publishes scm_event.failed exactly once, with the ids and repo of the failed event', async () => {
    const prisma = createPrisma({
      ...defaultEvent,
      organizationId: 'org-1',
      connectionId: 'connection-1',
    });
    const events = createEvents();
    const failure = new Error('downstream unavailable');
    prisma.ingestionBatch.create.mockRejectedValueOnce(failure);

    await expect(
      new IngestionProcessor(
        prisma as never,
        events as never,
        createExtraction() as never,
      ).process(job('event-2')),
    ).rejects.toThrow(failure);

    expect(events.publish).toHaveBeenCalledTimes(1);
    expect(events.publish).toHaveBeenCalledWith(DOMAIN_EVENTS.scmEventFailed, {
      scmEventId: 'event-2',
      organizationId: 'org-1',
      repo: 'acme/shop',
      connectionId: 'connection-1',
    });
  });

  it('publishes the failure only after the event has been written as FAILED', async () => {
    const prisma = createPrisma({
      ...defaultEvent,
      connectionId: 'connection-1',
    });
    const events = createEvents();
    prisma.ingestionBatch.create.mockRejectedValueOnce(new Error('boom'));

    await expect(
      new IngestionProcessor(
        prisma as never,
        events as never,
        createExtraction() as never,
      ).process(job('event-2')),
    ).rejects.toThrow('boom');

    const failedWrite = prisma.scmEvent.update.mock.invocationCallOrder.at(-1);
    const publish = events.publish.mock.invocationCallOrder[0];
    expect(failedWrite).toBeDefined();
    expect(publish).toBeGreaterThan(failedWrite as number);
  });

  it('publishes nothing when the event row is gone by the time the failure is reported', async () => {
    const prisma = createPrisma();
    const events = createEvents();
    const failure = new Error('downstream unavailable');
    prisma.scmEvent.findUnique
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(null);

    await expect(
      new IngestionProcessor(
        prisma as never,
        events as never,
        createExtraction() as never,
      ).process(job('event-2')),
    ).rejects.toBe(failure);

    expect(events.publish).not.toHaveBeenCalled();
  });

  it('rethrows the original error when the lookup inside the failure path throws', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const prisma = createPrisma();
    const events = createEvents();
    const failure = new Error('downstream unavailable');
    prisma.scmEvent.findUnique
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(new Error('connection reset'));

    await expect(
      new IngestionProcessor(
        prisma as never,
        events as never,
        createExtraction() as never,
      ).process(job('event-2')),
    ).rejects.toBe(failure);

    expect(prisma.scmEvent.update).toHaveBeenLastCalledWith({
      where: { id: 'event-2' },
      data: { status: 'FAILED' },
    });
    expect(events.publish).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    const [message] = warn.mock.calls[0] as [string];
    expect(message).toContain('event-2');
    expect(message).toContain('connection reset');
    warn.mockRestore();
  });

  it('does not publish a failure event on the success path', async () => {
    const prisma = createPrisma();
    const events = createEvents();

    await new IngestionProcessor(
      prisma as never,
      events as never,
      createExtraction() as never,
    ).process(job('event-1'));

    expect(events.publish).not.toHaveBeenCalled();
  });

  it('seeds review proposals from the code changes it just recorded', async () => {
    const prisma = createPrisma();
    const extraction = createExtraction();
    const codeChanges = [
      {
        id: 'change-1',
        projectId: 'proj-1',
        filePath: 'src/cart.spec.ts',
        detectedPattern: '*.spec.ts',
        evidenceId: 'evidence-1',
      },
      {
        id: 'change-2',
        projectId: 'proj-1',
        filePath: 'src/cart.ts',
        detectedPattern: null,
        evidenceId: 'evidence-2',
      },
    ];
    prisma.ingestionBatch.create.mockResolvedValue({ codeChanges });

    await new IngestionProcessor(
      prisma as never,
      createEvents() as never,
      extraction as never,
    ).process(job('event-1'));

    expect(extraction.enqueueCodeChanges).toHaveBeenCalledWith(
      codeChanges,
      'org-1',
    );
  });

  describe('extraction branch gate', () => {
    async function runOn(event: {
      branch: string;
      defaultBranch: string | null;
      commits?: StoredCommit[];
    }) {
      const prisma = createPrisma({
        ...defaultEvent,
        ...event,
        connection: {
          projects: [
            { id: 'proj-1', testFilePatterns: ['*.spec.ts'] },
            { id: 'proj-2', testFilePatterns: ['*.spec.ts'] },
          ],
        },
      });
      const extraction = createExtraction();

      await new IngestionProcessor(
        prisma as never,
        createEvents() as never,
        extraction as never,
      ).process(job('event-1'));

      return { prisma, extraction };
    }

    let log: jest.SpyInstance;

    beforeEach(() => {
      log = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);
    });

    afterEach(() => {
      log.mockRestore();
    });

    it('loads the pushed branch and the default branch of the event', async () => {
      const prisma = createPrisma();

      await new IngestionProcessor(
        prisma as never,
        createEvents() as never,
        createExtraction() as never,
      ).process(job('event-1'));

      const [[query]] = prisma.scmEvent.findUnique.mock.calls as [
        [{ select: Record<string, unknown> }],
      ];

      expect(query.select).toEqual(
        expect.objectContaining({ branch: true, defaultBranch: true }),
      );
    });

    it('records every batch but enqueues no extraction for a branch other than the default', async () => {
      const { prisma, extraction } = await runOn({
        branch: 'feat/cart',
        defaultBranch: 'main',
      });

      expect(prisma.ingestionBatch.create).toHaveBeenCalledTimes(2);
      expect(extraction.enqueueCodeChanges).not.toHaveBeenCalled();
      expect(prisma.scmEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: { status: 'PROCESSED' },
      });
    });

    it('records the same code changes whether or not the push is extracted', async () => {
      const commits = [
        {
          sha: '1'.repeat(40),
          position: 0,
          attributedFiles: ['src/cart.spec.ts'],
        },
      ];

      const skipped = await runOn({
        branch: 'feat/cart',
        defaultBranch: 'main',
        commits,
      });
      const extracted = await runOn({
        branch: 'main',
        defaultBranch: 'main',
        commits,
      });

      const rows = batchCalls(skipped.prisma).map(
        (call) => call.data.codeChanges.create,
      );

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual([
        expect.objectContaining({
          filePath: 'src/cart.spec.ts',
          commitSha: '1'.repeat(40),
          detectedPattern: '*.spec.ts',
        }),
        expect.objectContaining({
          filePath: 'src/cart.ts',
          commitSha: TIP,
          detectedPattern: null,
        }),
      ]);
      expect(batchCalls(skipped.prisma)).toEqual(batchCalls(extracted.prisma));
      expect(skipped.extraction.enqueueCodeChanges).not.toHaveBeenCalled();
      expect(extracted.extraction.enqueueCodeChanges).toHaveBeenCalledTimes(2);
    });

    it('enqueues no extraction for a tag push, which is never the default branch', async () => {
      const { prisma, extraction } = await runOn({
        branch: 'refs/tags/v1',
        defaultBranch: 'main',
      });

      expect(prisma.ingestionBatch.create).toHaveBeenCalledTimes(2);
      expect(extraction.enqueueCodeChanges).not.toHaveBeenCalled();
    });

    it('enqueues extraction for every project when the push is on the default branch', async () => {
      const { extraction } = await runOn({
        branch: 'main',
        defaultBranch: 'main',
      });

      expect(extraction.enqueueCodeChanges).toHaveBeenCalledTimes(2);
      expect(log).not.toHaveBeenCalled();
    });

    it('enqueues extraction when the default branch is unknown', async () => {
      const { extraction } = await runOn({
        branch: 'feat/cart',
        defaultBranch: null,
      });

      expect(extraction.enqueueCodeChanges).toHaveBeenCalledTimes(2);
      expect(log).not.toHaveBeenCalled();
    });

    it('compares branch names exactly, so a different case is another branch', async () => {
      const { extraction } = await runOn({
        branch: 'Main',
        defaultBranch: 'main',
      });

      expect(extraction.enqueueCodeChanges).not.toHaveBeenCalled();
    });

    it('logs one line naming the event, the pushed ref, the default branch and the file count when it skips', async () => {
      await runOn({ branch: 'refs/tags/v1', defaultBranch: 'main' });

      expect(log).toHaveBeenCalledTimes(1);
      const [message] = log.mock.calls[0] as [string];
      expect(message).toContain('event-1');
      expect(message).toContain('org-1');
      expect(message).toContain('"refs/tags/v1"');
      expect(message).toContain('"main"');
      expect(message).toContain('changed files: 2');
      expect(message).not.toContain('acme/shop');
    });
  });

  it('marks the event processed even when nothing was worth extracting', async () => {
    const prisma = createPrisma();
    const extraction = createExtraction();
    prisma.ingestionBatch.create.mockResolvedValue({ codeChanges: [] });

    await new IngestionProcessor(
      prisma as never,
      createEvents() as never,
      extraction as never,
    ).process(job('event-1'));

    expect(extraction.enqueueCodeChanges).toHaveBeenCalledWith([], 'org-1');
    expect(prisma.scmEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { status: 'PROCESSED' },
    });
  });
});
