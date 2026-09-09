import type { OrgContext } from '../organizations/organizations.contracts';
import { SuitesService } from './suites.service';

const owner: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'owner',
};
const member: OrgContext = { ...owner, role: 'member' };

const suiteRow = {
  id: 'suite-1',
  projectId: 'project-1',
  organizationId: 'org-1',
  name: 'Checkout',
  description: '',
  tags: [],
  isDefault: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  cases: [
    {
      id: 'case-1',
      suiteId: 'suite-1',
      name: 'Adds to cart',
      steps: ['open', 'add'],
      expectedResult: 'cart has one item',
      priority: 'medium' as const,
      state: 'active' as const,
      currentVersion: { version: 3 },
      executionMode: 'manual' as const,
      automationKey: null,
      automationClassName: null,
      automationFilePath: null,
    },
  ],
};

interface FakePrisma {
  suite: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    delete: jest.Mock;
  };
  testCase: { create: jest.Mock; update: jest.Mock; delete: jest.Mock };
  runCase: { findMany: jest.Mock };
  project: { findFirst: jest.Mock };
  extractedProposal: { findMany: jest.Mock };
  $transaction: jest.Mock;
}

function createPrisma(): FakePrisma {
  const prisma: FakePrisma = {
    suite: {
      findMany: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(suiteRow),
      findUniqueOrThrow: jest.fn().mockResolvedValue(suiteRow),
      create: jest.fn().mockResolvedValue(suiteRow),
      update: jest.fn().mockResolvedValue(suiteRow),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    testCase: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    runCase: { findMany: jest.fn().mockResolvedValue([]) },
    project: { findFirst: jest.fn().mockResolvedValue({ id: 'project-1' }) },
    extractedProposal: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(),
  };

  prisma.$transaction.mockImplementation((run: (tx: FakePrisma) => unknown) =>
    run(prisma),
  );

  return prisma;
}

function build(prisma: FakePrisma) {
  return new SuitesService(prisma as never);
}

const baseSuiteInput = {
  projectId: 'project-1',
  name: 'Checkout',
  description: '',
  tags: [],
  isDefault: false,
};

describe('SuitesService case versions', () => {
  it('projects the published version onto each case', async () => {
    const prisma = createPrisma();
    prisma.suite.findMany.mockResolvedValue([suiteRow]);

    const suites = await build(prisma).list(owner);

    expect(suites[0].cases[0].version).toBe(3);
  });

  it('reports a null version when the case has no published version', async () => {
    const prisma = createPrisma();
    prisma.suite.findMany.mockResolvedValue([
      {
        ...suiteRow,
        cases: [{ ...suiteRow.cases[0], currentVersion: null }],
      },
    ]);

    const suites = await build(prisma).list(owner);

    expect(suites[0].cases[0].version).toBeNull();
  });
});

describe('SuitesService.list', () => {
  it('scopes every read to the caller organization', async () => {
    const prisma = createPrisma();
    prisma.suite.findMany.mockResolvedValue([suiteRow]);

    await build(prisma).list(owner);

    expect(prisma.suite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' } }),
    );
  });

  it('narrows to one project when asked', async () => {
    const prisma = createPrisma();
    prisma.suite.findMany.mockResolvedValue([]);

    await build(prisma).list(owner, 'project-1');

    expect(prisma.suite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', projectId: 'project-1' },
      }),
    );
  });

  it('serialises timestamps and keeps the embedded cases', async () => {
    const prisma = createPrisma();
    prisma.suite.findMany.mockResolvedValue([suiteRow]);

    const [suite] = await build(prisma).list(owner);

    expect(suite.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(suite.cases).toHaveLength(1);
  });
});

describe('SuitesService pending proposals', () => {
  it('reports the in_review proposal id targeting a case', async () => {
    const prisma = createPrisma();
    prisma.suite.findMany.mockResolvedValue([suiteRow]);
    prisma.extractedProposal.findMany.mockResolvedValue([
      { id: 'proposal-1', targetTestCaseId: 'case-1' },
    ]);

    const [suite] = await build(prisma).list(owner);

    expect(suite.cases[0].pendingProposalId).toBe('proposal-1');
    expect(prisma.extractedProposal.findMany).toHaveBeenCalledWith({
      where: { targetTestCaseId: { in: ['case-1'] }, status: 'in_review' },
      select: { id: true, targetTestCaseId: true },
    });
  });

  it('reports null when no proposal targets the case', async () => {
    const prisma = createPrisma();
    prisma.suite.findMany.mockResolvedValue([suiteRow]);

    const [suite] = await build(prisma).list(owner);

    expect(suite.cases[0].pendingProposalId).toBeNull();
  });
});

describe('SuitesService.create', () => {
  it('refuses a project outside the caller organization', async () => {
    const prisma = createPrisma();
    prisma.project.findFirst.mockResolvedValue(null);

    const result = await build(prisma).create(owner, {
      ...baseSuiteInput,
      projectId: 'project-x',
    });

    expect(result).toEqual({ ok: false, error: 'not-found' });
    expect(prisma.suite.create).not.toHaveBeenCalled();
  });

  it('demotes the previous default when the new suite claims it', async () => {
    const prisma = createPrisma();

    await build(prisma).create(owner, { ...baseSuiteInput, isDefault: true });

    expect(prisma.suite.updateMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1', isDefault: true },
      data: { isDefault: false },
    });
  });

  it('leaves the existing default alone for a non-default suite', async () => {
    const prisma = createPrisma();

    await build(prisma).create(owner, baseSuiteInput);

    expect(prisma.suite.updateMany).not.toHaveBeenCalled();
  });

  it('stamps the caller organization onto the suite', async () => {
    const prisma = createPrisma();

    await build(prisma).create(owner, baseSuiteInput);

    const [call] = prisma.suite.create.mock.calls as [
      [{ data: { organizationId: string } }],
    ];
    expect(call[0].data.organizationId).toBe('org-1');
  });

  it('reports a duplicate name rather than leaking the database error', async () => {
    const prisma = createPrisma();
    prisma.suite.create.mockRejectedValue({ code: 'P2002' });

    const result = await build(prisma).create(owner, baseSuiteInput);

    expect(result).toEqual({ ok: false, error: 'name-taken' });
  });
});

describe('SuitesService.update', () => {
  it('promotes one suite and demotes the rest of the project', async () => {
    const prisma = createPrisma();

    await build(prisma).update(owner, 'suite-1', { isDefault: true });

    expect(prisma.suite.updateMany).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        isDefault: true,
        id: { not: 'suite-1' },
      },
      data: { isDefault: false },
    });
  });

  it('refuses a suite from another organization', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue(null);

    await expect(
      build(prisma).update(owner, 'suite-x', { name: 'New' }),
    ).resolves.toEqual({ ok: false, error: 'not-found' });
  });
});

describe('SuitesService.remove', () => {
  it('refuses a plain member before looking anything up', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).remove(member, 'suite-1');

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(prisma.suite.findFirst).not.toHaveBeenCalled();
  });

  it('deletes a suite the owner can see', async () => {
    const prisma = createPrisma();

    await expect(build(prisma).remove(owner, 'suite-1')).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(prisma.suite.delete).toHaveBeenCalledWith({
      where: { id: 'suite-1' },
    });
  });
});

describe('SuitesService case mutations', () => {
  const caseInput = {
    name: 'Removes from cart',
    steps: [],
    expectedResult: '',
    priority: 'medium' as const,
    state: 'active' as const,
  };

  it('appends a new case after the existing ones', async () => {
    const prisma = createPrisma();

    await build(prisma).addCase(owner, 'suite-1', caseInput);

    const [call] = prisma.testCase.create.mock.calls as [
      [{ data: { position: number; suiteId: string } }],
    ];
    expect(call[0].data.position).toBe(1);
    expect(call[0].data.suiteId).toBe('suite-1');
  });

  it('never sets execution mode or automation fields, leaving the manual default in place', async () => {
    const prisma = createPrisma();

    await build(prisma).addCase(owner, 'suite-1', caseInput);

    const [call] = prisma.testCase.create.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(call[0].data).not.toHaveProperty('executionMode');
    expect(call[0].data).not.toHaveProperty('automationKey');
  });

  it('refuses to patch a case that is not in the suite', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).updateCase(
      owner,
      'suite-1',
      'case-from-elsewhere',
      { name: 'Renamed' },
    );

    expect(result).toEqual({ ok: false, error: 'not-found' });
    expect(prisma.testCase.update).not.toHaveBeenCalled();
  });

  it('refuses to delete a case that is not in the suite', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).removeCase(
      owner,
      'suite-1',
      'case-from-elsewhere',
    );

    expect(result).toEqual({ ok: false, error: 'not-found' });
    expect(prisma.testCase.delete).not.toHaveBeenCalled();
  });

  it('returns the whole suite after a case changes', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).removeCase(owner, 'suite-1', 'case-1');

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.id).toBe('suite-1');
  });
});

describe('SuitesService case promotion', () => {
  it('promotes a draft case to active through the existing case update', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).updateCase(owner, 'suite-1', 'case-1', {
      state: 'active',
    });

    expect(prisma.testCase.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: { state: 'active' },
    });
    expect(result.ok).toBe(true);
  });

  it('refuses to promote a case that is not in the suite', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).updateCase(
      owner,
      'suite-1',
      'case-elsewhere',
      { state: 'active' },
    );

    expect(result).toEqual({ ok: false, error: 'not-found' });
    expect(prisma.testCase.update).not.toHaveBeenCalled();
  });
});

describe('SuitesService execution mode counts', () => {
  it('counts manual and automated cases separately', async () => {
    const prisma = createPrisma();
    prisma.suite.findMany.mockResolvedValue([
      {
        ...suiteRow,
        cases: [
          suiteRow.cases[0],
          {
            ...suiteRow.cases[0],
            id: 'case-2',
            executionMode: 'automated' as const,
            automationKey: 'checkout.spec > adds to cart',
          },
        ],
      },
    ]);

    const [suite] = await build(prisma).list(owner);

    expect(suite.manualCases).toBe(1);
    expect(suite.automatedCases).toBe(1);
  });

  it('exposes automation metadata only for automated cases', async () => {
    const prisma = createPrisma();
    prisma.suite.findMany.mockResolvedValue([
      {
        ...suiteRow,
        cases: [
          {
            ...suiteRow.cases[0],
            id: 'case-2',
            executionMode: 'automated' as const,
            automationKey: 'raw case name',
            automationClassName: 'CheckoutSpec',
            automationFilePath: 'e2e/checkout.spec.ts',
          },
        ],
      },
    ]);

    const [suite] = await build(prisma).list(owner);

    expect(suite.cases[0]).toEqual(
      expect.objectContaining({
        executionMode: 'automated',
        automationKey: 'raw case name',
        automationClassName: 'CheckoutSpec',
        automationFilePath: 'e2e/checkout.spec.ts',
      }),
    );
  });

  it('omits automation metadata for a manual case', async () => {
    const prisma = createPrisma();
    prisma.suite.findMany.mockResolvedValue([suiteRow]);

    const [suite] = await build(prisma).list(owner);

    expect(suite.cases[0]).not.toHaveProperty('automationKey');
    expect(suite.cases[0]).not.toHaveProperty('lastResult');
  });
});

describe('SuitesService automated case last result', () => {
  const automatedSuiteRow = {
    ...suiteRow,
    cases: [
      {
        ...suiteRow.cases[0],
        id: 'case-2',
        executionMode: 'automated' as const,
        automationKey: 'raw case name',
      },
    ],
  };

  it('attaches the latest run outcome to an automated case', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue(automatedSuiteRow);
    prisma.runCase.findMany.mockResolvedValue([
      {
        testCaseId: 'case-2',
        status: 'pass' as const,
        recordedAt: null,
        run: {
          id: 'run-9',
          commitSha: 'abc123',
          startedAt: new Date('2026-02-01T00:00:00.000Z'),
        },
      },
    ]);

    const result = await build(prisma).findOne(owner, 'suite-1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cases[0].lastResult).toEqual({
      status: 'pass',
      runId: 'run-9',
      commitSha: 'abc123',
      recordedAt: '2026-02-01T00:00:00.000Z',
    });
  });

  it('queries run history once for every automated case, scoped to their ids', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue(automatedSuiteRow);

    await build(prisma).findOne(owner, 'suite-1');

    expect(prisma.runCase.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.runCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { testCaseId: { in: ['case-2'] } },
        distinct: ['testCaseId'],
      }),
    );
  });

  it('breaks a startedAt tie deterministically by run id', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue(automatedSuiteRow);

    await build(prisma).findOne(owner, 'suite-1');

    expect(prisma.runCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ run: { startedAt: 'desc' } }, { id: 'desc' }],
      }),
    );
  });

  it('reports a null lastResult for an automated case with no run history yet', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue(automatedSuiteRow);
    prisma.runCase.findMany.mockResolvedValue([]);

    const result = await build(prisma).findOne(owner, 'suite-1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cases[0].lastResult).toBeNull();
  });

  it('never queries run history when the suite has no automated cases', async () => {
    const prisma = createPrisma();

    await build(prisma).findOne(owner, 'suite-1');

    expect(prisma.runCase.findMany).not.toHaveBeenCalled();
  });
});
