import type { Locale } from '@qably/i18n';
import { SuiteViewAssembler } from './suite-view.assembler';
import { toView, type CaseRow, type SuiteRow } from './lib/suite-view';

const locale: Locale = 'en';

function caseRow(id: string, suiteId = 'suite-1'): CaseRow {
  return {
    id,
    suiteId,
    name: `Case ${id}`,
    objective: '',
    preconditions: [],
    steps: [],
    expectedResult: '',
    priority: 'medium',
    state: 'active',
    executionMode: 'manual',
    automationKey: null,
    automationClassName: null,
    automationFilePath: null,
    documentationSource: 'human',
    documentationQueuedAt: null,
    documentationOutcome: null,
    documentationOutcomeAt: null,
    documentationMissing: [],
    documentationSkipReason: null,
    currentVersion: null,
  };
}

function suiteRow(id: string, caseIds: string[]): SuiteRow {
  return {
    id,
    projectId: 'project-1',
    organizationId: 'org-1',
    name: `Suite ${id}`,
    description: '',
    tags: [],
    isDefault: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    documentationQueuedAt: null,
    documentationOutcome: null,
    documentationOutcomeAt: null,
    documentationMissing: [],
    documentationSkipReason: null,
    cases: caseIds.map((caseId) => caseRow(caseId, id)),
  };
}

interface PendingProposal {
  id: string;
  targetTestCaseId: string | null;
  matchedCaseId: string | null;
}

interface NewCaseCount {
  suiteId: string | null;
  _count: { _all: number };
}

function fakePrisma(
  pending: PendingProposal[] = [],
  newCaseCounts: NewCaseCount[] = [],
) {
  return {
    runCase: { findMany: jest.fn().mockResolvedValue([]) },
    testCase: { findMany: jest.fn().mockResolvedValue([]) },
    extractedProposal: {
      findMany: jest.fn().mockResolvedValue(pending),
      groupBy: jest.fn().mockResolvedValue(newCaseCounts),
    },
    caseIdentityCollision: { groupBy: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
}

async function assemble(
  prisma: ReturnType<typeof fakePrisma>,
  rows: SuiteRow[] = [suiteRow('suite-1', ['case-1', 'case-2'])],
) {
  const views = rows.map((row) => toView(row, locale));

  return new SuiteViewAssembler(prisma as never).withLastResults(
    views,
    rows,
    locale,
  );
}

describe('SuiteViewAssembler pending proposal per case', () => {
  it('points a case at the proposal that targets it', async () => {
    const prisma = fakePrisma([
      { id: 'proposal-1', targetTestCaseId: 'case-1', matchedCaseId: 'case-1' },
    ]);

    const [suite] = await assemble(prisma);

    expect(suite.cases[0].pendingProposalId).toBe('proposal-1');
    expect(suite.cases[1].pendingProposalId).toBeNull();
  });

  it('points a case at the possible duplicate that was matched to it, though no proposal targets it', async () => {
    const prisma = fakePrisma([
      { id: 'proposal-2', targetTestCaseId: null, matchedCaseId: 'case-2' },
    ]);

    const [suite] = await assemble(prisma);

    expect(suite.cases[1].pendingProposalId).toBe('proposal-2');
    expect(suite.cases[0].pendingProposalId).toBeNull();
  });

  it('keeps the oldest waiting proposal when several wait for the same case', async () => {
    const prisma = fakePrisma([
      { id: 'proposal-old', targetTestCaseId: 'case-1', matchedCaseId: null },
      { id: 'proposal-mid', targetTestCaseId: null, matchedCaseId: 'case-1' },
      { id: 'proposal-new', targetTestCaseId: 'case-1', matchedCaseId: null },
    ]);

    const [suite] = await assemble(prisma);

    expect(suite.cases[0].pendingProposalId).toBe('proposal-old');
  });

  it('shows one proposal on both cases it touches, the one it targets and the one it matched', async () => {
    const prisma = fakePrisma([
      { id: 'proposal-1', targetTestCaseId: 'case-1', matchedCaseId: 'case-2' },
    ]);

    const [suite] = await assemble(prisma);

    expect(suite.cases.map((testCase) => testCase.pendingProposalId)).toEqual([
      'proposal-1',
      'proposal-1',
    ]);
  });

  it('reads every waiting proposal of every visible case in one bounded, ordered query', async () => {
    const prisma = fakePrisma();

    await assemble(prisma, [
      suiteRow('suite-1', ['case-1', 'case-2']),
      suiteRow('suite-2', ['case-3']),
    ]);

    expect(prisma.extractedProposal.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.extractedProposal.findMany).toHaveBeenCalledWith({
      where: {
        status: 'in_review',
        needsManualReview: false,
        OR: [
          { targetTestCaseId: { in: ['case-1', 'case-2', 'case-3'] } },
          { matchedCaseId: { in: ['case-1', 'case-2', 'case-3'] } },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, targetTestCaseId: true, matchedCaseId: true },
    });
  });

  it('skips the lookup when the suites have no cases', async () => {
    const prisma = fakePrisma();

    await assemble(prisma, [suiteRow('suite-1', [])]);

    expect(prisma.extractedProposal.findMany).not.toHaveBeenCalled();
  });

  it('leaves out placeholder proposals that were flagged for manual review, which cannot be approved', async () => {
    const prisma = fakePrisma();

    await assemble(prisma);

    expect(prisma.extractedProposal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ needsManualReview: false }) as unknown,
      }),
    );
  });
});

describe('SuiteViewAssembler proposals that would create new cases', () => {
  it('counts, per suite, the waiting proposals no case can carry', async () => {
    const prisma = fakePrisma(
      [],
      [
        { suiteId: 'suite-1', _count: { _all: 3 } },
        { suiteId: 'suite-2', _count: { _all: 1 } },
      ],
    );

    const [first, second, third] = await assemble(prisma, [
      suiteRow('suite-1', ['case-1']),
      suiteRow('suite-2', ['case-2']),
      suiteRow('suite-3', ['case-3']),
    ]);

    expect(first.newCaseProposals).toBe(3);
    expect(second.newCaseProposals).toBe(1);
    expect(third.newCaseProposals).toBe(0);
  });

  it('counts only proposals that neither target nor match an existing case', async () => {
    const prisma = fakePrisma();

    await assemble(prisma);

    expect(prisma.extractedProposal.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['suiteId'],
        where: {
          suiteId: { in: ['suite-1'] },
          status: 'in_review',
          needsManualReview: false,
          targetTestCaseId: null,
          matchedCaseId: null,
        },
      }),
    );
  });

  it('ignores proposals that belong to no suite', async () => {
    const prisma = fakePrisma([], [{ suiteId: null, _count: { _all: 4 } }]);

    const [suite] = await assemble(prisma);

    expect(suite.newCaseProposals).toBe(0);
  });
});
