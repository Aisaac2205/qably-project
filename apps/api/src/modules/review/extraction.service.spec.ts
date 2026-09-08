import { DEFAULT_LOCALE } from '@qably/i18n';
import type { OrgContext } from '../organizations/organizations.contracts';
import { ExtractionService } from './extraction.service';

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
  testCase: { findFirst: jest.Mock };
  extractedProposal: { findFirst: jest.Mock };
  orgMember: { findFirst: jest.Mock };
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
        executionMode: 'automated',
        automationFilePath: 'src/cart.spec.ts',
      }),
    },
    extractedProposal: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    orgMember: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          ownerLocale === null ? null : { user: { locale: ownerLocale } },
        ),
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

  it('returns not-automated when the case has no automation file path', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    prisma.testCase.findFirst.mockResolvedValue({
      id: 'case-1',
      executionMode: 'automated',
      automationFilePath: null,
    });

    const result = await build(prisma, queue).enqueueDocumentCase(
      org,
      'suite-1',
      'case-1',
      null,
    );

    expect(result).toEqual({ ok: false, error: 'not-automated' });
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
