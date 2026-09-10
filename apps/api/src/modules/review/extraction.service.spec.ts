import { DEFAULT_LOCALE } from '@qably/i18n';
import type { OrgContext } from '../organizations/organizations.contracts';
import {
  ExtractionService,
  MAX_DOCUMENT_FILES_PER_REQUEST,
} from './extraction.service';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'admin',
};

interface FakeQueue {
  add: jest.Mock;
  addBulk: jest.Mock;
}

interface FakePrisma {
  testCase: { findFirst: jest.Mock; findMany: jest.Mock };
  extractedProposal: { findFirst: jest.Mock; findMany: jest.Mock };
  orgMember: { findFirst: jest.Mock };
  suite: { findFirst: jest.Mock };
  project: { findFirst: jest.Mock };
}

function createQueue(): FakeQueue {
  return {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    addBulk: jest.fn().mockResolvedValue([]),
  };
}

function createPrisma(ownerLocale: string | null = null): FakePrisma {
  return {
    testCase: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'case-1',
        projectId: 'proj-1',
        executionMode: 'automated',
        automationFilePath: 'src/cart.spec.ts',
        automationKey: 'CartTest.addsItem',
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    extractedProposal: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    orgMember: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          ownerLocale === null ? null : { user: { locale: ownerLocale } },
        ),
    },
    suite: {
      findFirst: jest.fn().mockResolvedValue({ id: 'suite-1' }),
    },
    project: {
      findFirst: jest.fn().mockResolvedValue({ id: 'proj-1' }),
    },
  };
}

function build(prisma: FakePrisma, queue: FakeQueue) {
  return new ExtractionService(prisma as never, queue as never);
}

describe('ExtractionService.enqueueCodeChanges', () => {
  it('enqueues one bulk job per detected code change, stamped with the organization default locale', async () => {
    const queue = createQueue();
    const prisma = createPrisma('en');

    const count = await build(prisma, queue).enqueueCodeChanges(
      [
        { id: 'change-1', detectedPattern: '*.spec.ts' },
        { id: 'change-2', detectedPattern: '*.spec.ts' },
      ],
      'org-1',
    );

    expect(count).toBe(2);
    const [jobs] = queue.addBulk.mock.calls[0] as [
      { data: Record<string, unknown>; opts: Record<string, unknown> }[],
    ];
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      data: { kind: 'code-change', codeChangeId: 'change-1', locale: 'en' },
      opts: { jobId: 'code-change:change-1' },
    });
    expect(jobs[1]).toMatchObject({
      data: { kind: 'code-change', codeChangeId: 'change-2', locale: 'en' },
      opts: { jobId: 'code-change:change-2' },
    });
  });

  it("falls back to the default locale when the organization's owner has no preference", async () => {
    const queue = createQueue();
    const prisma = createPrisma(null);

    await build(prisma, queue).enqueueCodeChanges(
      [{ id: 'change-1', detectedPattern: '*.spec.ts' }],
      'org-1',
    );

    const [jobs] = queue.addBulk.mock.calls[0] as [
      { data: Record<string, unknown> }[],
    ];
    expect(jobs[0].data).toMatchObject({ locale: DEFAULT_LOCALE });
  });

  it('never enqueues a file that matched no declared test pattern', async () => {
    const queue = createQueue();
    const prisma = createPrisma();

    const count = await build(prisma, queue).enqueueCodeChanges(
      [{ id: 'change-1', detectedPattern: null }],
      'org-1',
    );

    expect(count).toBe(0);
    expect(queue.addBulk).not.toHaveBeenCalled();
  });

  it('never touches the queue or looks up the organization when there are no candidates', async () => {
    const queue = createQueue();
    const prisma = createPrisma();

    await build(prisma, queue).enqueueCodeChanges([], 'org-1');

    expect(queue.addBulk).not.toHaveBeenCalled();
    expect(prisma.orgMember.findFirst).not.toHaveBeenCalled();
  });
});

describe('ExtractionService.enqueueDocumentCase', () => {
  it("uses the acting user's locale when one is set", async () => {
    const queue = createQueue();
    const prisma = createPrisma('en');

    const result = await build(prisma, queue).enqueueDocumentCase(
      org,
      'suite-1',
      'case-1',
      'es',
    );

    expect(result).toEqual({
      ok: true,
      value: { jobId: 'document-case:case-1' },
    });
    expect(queue.add).toHaveBeenCalledWith(
      'document-case',
      { kind: 'document-case', testCaseId: 'case-1', locale: 'es' },
      expect.objectContaining({ jobId: 'document-case:case-1' }),
    );
    expect(prisma.orgMember.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to the organization default when the acting user has no locale', async () => {
    const queue = createQueue();
    const prisma = createPrisma('en');

    await build(prisma, queue).enqueueDocumentCase(
      org,
      'suite-1',
      'case-1',
      null,
    );

    expect(queue.add).toHaveBeenCalledWith(
      'document-case',
      expect.objectContaining({ locale: 'en' }),
      expect.anything(),
    );
  });

  it('falls back to the default locale when neither the user nor the organization has a preference', async () => {
    const queue = createQueue();
    const prisma = createPrisma(null);

    await build(prisma, queue).enqueueDocumentCase(
      org,
      'suite-1',
      'case-1',
      null,
    );

    expect(queue.add).toHaveBeenCalledWith(
      'document-case',
      expect.objectContaining({ locale: DEFAULT_LOCALE }),
      expect.anything(),
    );
  });

  it('returns not-found when the case does not belong to the organization scope', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    prisma.testCase.findFirst.mockResolvedValue(null);

    const result = await build(prisma, queue).enqueueDocumentCase(
      org,
      'suite-1',
      'case-1',
      null,
    );

    expect(result).toEqual({ ok: false, error: 'not-found' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('returns not-automated when the case is still manual', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    prisma.testCase.findFirst.mockResolvedValue({
      id: 'case-1',
      executionMode: 'manual',
      automationFilePath: null,
    });

    const result = await build(prisma, queue).enqueueDocumentCase(
      org,
      'suite-1',
      'case-1',
      null,
    );

    expect(result).toEqual({ ok: false, error: 'not-automated' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('resolves the file path from the repository change that produced the same key', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    prisma.testCase.findFirst.mockResolvedValueOnce({
      id: 'case-1',
      projectId: 'proj-1',
      executionMode: 'automated',
      automationFilePath: null,
      automationKey: 'CartTest.addsItem',
    });
    prisma.extractedProposal.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        codeChange: { filePath: 'src/cart.spec.ts' },
      });

    const result = await build(prisma, queue).enqueueDocumentCase(
      org,
      'suite-1',
      'case-1',
      null,
    );

    expect(result).toEqual({
      ok: true,
      value: { jobId: 'document-case:case-1' },
    });
    expect(queue.add).toHaveBeenCalled();
  });

  it('returns no-source-file when the repository never produced that key', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    prisma.testCase.findFirst
      .mockResolvedValueOnce({
        id: 'case-1',
        projectId: 'proj-1',
        executionMode: 'automated',
        automationFilePath: null,
        automationKey: 'CartTest.addsItem',
      })
      .mockResolvedValueOnce(null);
    prisma.extractedProposal.findFirst.mockResolvedValue(null);

    const result = await build(prisma, queue).enqueueDocumentCase(
      org,
      'suite-1',
      'case-1',
      null,
    );

    expect(result).toEqual({ ok: false, error: 'no-source-file' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('returns already-pending when a proposal already targets the case', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    prisma.extractedProposal.findFirst.mockResolvedValue({ id: 'proposal-1' });

    const result = await build(prisma, queue).enqueueDocumentCase(
      org,
      'suite-1',
      'case-1',
      null,
    );

    expect(result).toEqual({ ok: false, error: 'already-pending' });
    expect(queue.add).not.toHaveBeenCalled();
  });
});

describe('ExtractionService.enqueueDocumentFiles', () => {
  function candidate(overrides: Record<string, unknown> = {}) {
    return {
      id: 'case-1',
      projectId: 'proj-1',
      automationKey: 'Cart > adds an item',
      automationFilePath: 'src/cart.spec.ts',
      ...overrides,
    };
  }

  it('returns not-found when the suite is not in this organization', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue(null);

    const result = await build(prisma, queue).enqueueDocumentFiles(
      org,
      { suiteId: 'suite-1' },
      null,
    );

    expect(result).toEqual({ ok: false, error: 'not-found' });
    expect(queue.addBulk).not.toHaveBeenCalled();
  });

  it('returns not-found when the project is not in this organization', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    prisma.project.findFirst.mockResolvedValue(null);

    const result = await build(prisma, queue).enqueueDocumentFiles(
      org,
      { projectId: 'proj-1' },
      null,
    );

    expect(result).toEqual({ ok: false, error: 'not-found' });
    expect(queue.addBulk).not.toHaveBeenCalled();
  });

  it('returns an empty result when the scope has no undocumented automated cases', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    prisma.testCase.findMany.mockResolvedValue([]);

    const result = await build(prisma, queue).enqueueDocumentFiles(
      org,
      { suiteId: 'suite-1' },
      null,
    );

    expect(result).toEqual({
      ok: true,
      value: { filesEnqueued: 0, casesTargeted: 0, casesSkipped: [] },
    });
    expect(queue.addBulk).not.toHaveBeenCalled();
  });

  it('groups cases from the same file into a single job', async () => {
    const queue = createQueue();
    const prisma = createPrisma('en');
    prisma.testCase.findMany.mockResolvedValue([
      candidate({ id: 'case-1', automationKey: 'Cart > adds an item' }),
      candidate({ id: 'case-2', automationKey: 'Cart > removes an item' }),
    ]);

    const result = await build(prisma, queue).enqueueDocumentFiles(
      org,
      { suiteId: 'suite-1' },
      null,
    );

    expect(result).toEqual({
      ok: true,
      value: { filesEnqueued: 1, casesTargeted: 2, casesSkipped: [] },
    });
    const [jobs] = queue.addBulk.mock.calls[0] as [
      { data: Record<string, unknown>; opts: Record<string, unknown> }[],
    ];
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      data: {
        kind: 'document-file',
        filePath: 'src/cart.spec.ts',
        locale: 'en',
        targets: [
          { testCaseId: 'case-1', automationKey: 'Cart > adds an item' },
          { testCaseId: 'case-2', automationKey: 'Cart > removes an item' },
        ],
      },
      opts: { jobId: 'document-file:proj-1:src/cart.spec.ts:0' },
    });
  });

  it('scopes the job id by project so two projects sharing a file path never collide', async () => {
    const queue = createQueue();
    const prisma = createPrisma('en');
    prisma.testCase.findMany.mockResolvedValue([
      candidate({ id: 'case-9', projectId: 'proj-2' }),
    ]);

    await build(prisma, queue).enqueueDocumentFiles(
      org,
      { projectId: 'proj-2' },
      null,
    );

    const [jobs] = queue.addBulk.mock.calls[0] as [
      { opts: { jobId: string } }[],
    ];
    expect(jobs[0].opts.jobId).toBe('document-file:proj-2:src/cart.spec.ts:0');
  });

  it('caps how many files a single request can enqueue', async () => {
    const queue = createQueue();
    const prisma = createPrisma('en');
    const many = Array.from(
      { length: MAX_DOCUMENT_FILES_PER_REQUEST + 5 },
      (_, index) =>
        candidate({
          id: `case-${index}`,
          automationKey: `Cart > case ${index}`,
          automationFilePath: `src/cart-${index}.spec.ts`,
        }),
    );
    prisma.testCase.findMany.mockResolvedValue(many);

    const result = await build(prisma, queue).enqueueDocumentFiles(
      org,
      { projectId: 'proj-1' },
      null,
    );

    const [jobs] = queue.addBulk.mock.calls[0] as [unknown[]];
    expect(jobs).toHaveLength(MAX_DOCUMENT_FILES_PER_REQUEST);
    expect(result).toMatchObject({
      ok: true,
      value: {
        filesEnqueued: MAX_DOCUMENT_FILES_PER_REQUEST,
        casesTargeted: MAX_DOCUMENT_FILES_PER_REQUEST,
      },
    });
  });

  it('splits a file with more than 20 undocumented cases into chunked jobs', async () => {
    const queue = createQueue();
    const prisma = createPrisma('en');
    const many = Array.from({ length: 23 }, (_, index) =>
      candidate({
        id: `case-${index}`,
        automationKey: `Cart > case ${index}`,
      }),
    );
    prisma.testCase.findMany.mockResolvedValue(many);

    const result = await build(prisma, queue).enqueueDocumentFiles(
      org,
      { projectId: 'proj-1' },
      null,
    );

    expect(result).toEqual({
      ok: true,
      value: { filesEnqueued: 1, casesTargeted: 23, casesSkipped: [] },
    });
    const [jobs] = queue.addBulk.mock.calls[0] as [
      { data: { targets: unknown[] }; opts: Record<string, unknown> }[],
    ];
    expect(jobs).toHaveLength(2);
    expect(jobs[0].data.targets).toHaveLength(20);
    expect(jobs[1].data.targets).toHaveLength(3);
    expect(jobs[0].opts).toMatchObject({
      jobId: 'document-file:proj-1:src/cart.spec.ts:0',
    });
    expect(jobs[1].opts).toMatchObject({
      jobId: 'document-file:proj-1:src/cart.spec.ts:1',
    });
  });

  it('skips a case with no resolvable source file and counts it', async () => {
    const queue = createQueue();
    const prisma = createPrisma('en');
    prisma.testCase.findMany.mockResolvedValue([
      candidate({ automationFilePath: null }),
    ]);
    prisma.extractedProposal.findFirst.mockResolvedValue(null);
    prisma.testCase.findFirst.mockResolvedValue(null);

    const result = await build(prisma, queue).enqueueDocumentFiles(
      org,
      { suiteId: 'suite-1' },
      null,
    );

    expect(result).toEqual({
      ok: true,
      value: {
        filesEnqueued: 0,
        casesTargeted: 0,
        casesSkipped: [{ reason: 'no-source-file', count: 1 }],
      },
    });
    expect(queue.addBulk).not.toHaveBeenCalled();
  });

  it('skips a case with an in-review proposal already pending and counts it', async () => {
    const queue = createQueue();
    const prisma = createPrisma('en');
    prisma.testCase.findMany.mockResolvedValue([candidate()]);
    prisma.extractedProposal.findMany.mockResolvedValue([
      { targetTestCaseId: 'case-1' },
    ]);

    const result = await build(prisma, queue).enqueueDocumentFiles(
      org,
      { suiteId: 'suite-1' },
      null,
    );

    expect(result).toEqual({
      ok: true,
      value: {
        filesEnqueued: 0,
        casesTargeted: 0,
        casesSkipped: [{ reason: 'already-pending', count: 1 }],
      },
    });
    expect(queue.addBulk).not.toHaveBeenCalled();
  });

  it('counts distinct files, not chunks, in filesEnqueued', async () => {
    const queue = createQueue();
    const prisma = createPrisma('en');
    prisma.testCase.findMany.mockResolvedValue([
      candidate({
        id: 'case-1',
        automationKey: 'Cart > a',
        automationFilePath: 'src/cart.spec.ts',
      }),
      candidate({
        id: 'case-2',
        automationKey: 'Checkout > a',
        automationFilePath: 'src/checkout.spec.ts',
      }),
    ]);

    const result = await build(prisma, queue).enqueueDocumentFiles(
      org,
      { projectId: 'proj-1' },
      null,
    );

    expect(result).toEqual({
      ok: true,
      value: { filesEnqueued: 2, casesTargeted: 2, casesSkipped: [] },
    });
    expect(queue.addBulk).toHaveBeenCalledTimes(1);
    const [jobs] = queue.addBulk.mock.calls[0] as [unknown[]];
    expect(jobs).toHaveLength(2);
  });

  it("uses the acting user's locale when set, falling back to the org default otherwise", async () => {
    const queue = createQueue();
    const prisma = createPrisma('en');
    prisma.testCase.findMany.mockResolvedValue([candidate()]);

    await build(prisma, queue).enqueueDocumentFiles(
      org,
      { suiteId: 'suite-1' },
      'es',
    );

    const [jobs] = queue.addBulk.mock.calls[0] as [
      { data: Record<string, unknown> }[],
    ];
    expect(jobs[0].data).toMatchObject({ locale: 'es' });
  });
});

describe('ExtractionService.enqueueDocumentFiles stale-locale mode', () => {
  it('targets documented cases whose version locale is missing or differs from the organization locale', async () => {
    const queue = createQueue();
    const prisma = createPrisma('es');
    prisma.testCase.findMany.mockResolvedValue([]);

    await build(prisma, queue).enqueueDocumentFiles(
      org,
      { suiteId: 'suite-1' },
      null,
      'stale-locale',
    );

    expect(prisma.testCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          suiteId: 'suite-1',
          executionMode: 'automated',
          NOT: { steps: { equals: [] } },
          OR: [
            { currentVersion: null },
            { currentVersion: { locale: null } },
            { currentVersion: { locale: { not: 'es' } } },
          ],
        }) as unknown,
      }),
    );
  });

  it('keeps the undocumented mode byte-for-byte as before when no mode is given', async () => {
    const queue = createQueue();
    const prisma = createPrisma('es');
    prisma.testCase.findMany.mockResolvedValue([]);

    await build(prisma, queue).enqueueDocumentFiles(
      org,
      { suiteId: 'suite-1' },
      null,
    );

    expect(prisma.testCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          suiteId: 'suite-1',
          executionMode: 'automated',
          steps: { equals: [] },
        },
      }),
    );
    expect(prisma.orgMember.findFirst).not.toHaveBeenCalled();
  });
});
