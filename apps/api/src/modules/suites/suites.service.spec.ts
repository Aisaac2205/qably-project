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
  testCase: {
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    findMany: jest.Mock;
  };
  runCase: { findMany: jest.Mock };
  project: { findFirst: jest.Mock };
  extractedProposal: { findMany: jest.Mock };
  orgMember: { findFirst: jest.Mock };
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
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
    testCase: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    runCase: { findMany: jest.fn().mockResolvedValue([]) },
    project: { findFirst: jest.fn().mockResolvedValue({ id: 'project-1' }) },
    extractedProposal: { findMany: jest.fn().mockResolvedValue([]) },
    orgMember: {
      findFirst: jest.fn().mockResolvedValue({ user: { locale: 'en' } }),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([]),
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
      orderBy: { createdAt: 'asc' },
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

  it('never runs the flaky-window query when the suite has no automated cases', async () => {
    const prisma = createPrisma();

    await build(prisma).findOne(owner, 'suite-1');

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('SuitesService health signals', () => {
  const automatedCase = {
    id: 'case-2',
    suiteId: 'suite-1',
    name: 'checkout_pay',
    steps: [] as string[],
    expectedResult: '',
    priority: 'medium' as const,
    state: 'active' as const,
    currentVersion: null,
    executionMode: 'automated' as const,
    automationKey: 'checkout_pay',
    automationClassName: null,
    automationFilePath: null,
  };

  it('attaches the signals a case trips to its read model', async () => {
    const prisma = createPrisma();
    prisma.suite.findMany.mockResolvedValue([
      { ...suiteRow, cases: [automatedCase] },
    ]);

    const [suite] = await build(prisma).list(owner);

    expect(suite.cases[0].healthSignals).toEqual(
      expect.arrayContaining(['no-steps', 'raw-name', 'never-run']),
    );
  });

  it('rolls the case signals up into a suite-level summary, omitting zero counts', async () => {
    const prisma = createPrisma();
    prisma.suite.findMany.mockResolvedValue([
      { ...suiteRow, cases: [automatedCase] },
    ]);

    const [suite] = await build(prisma).list(owner);

    expect(suite.healthSummary).toEqual({
      'no-steps': 1,
      'raw-name': 1,
      'never-run': 1,
    });
    expect(suite.healthSummary).not.toHaveProperty('flaky');
  });

  it('reports an empty summary for a suite whose cases trip nothing', async () => {
    const prisma = createPrisma();
    prisma.suite.findMany.mockResolvedValue([suiteRow]);

    const [suite] = await build(prisma).list(owner);

    expect(suite.healthSummary).toEqual({});
  });

  it('flags duplicate-key across two cases in the same visible batch, scoped to project not suite', async () => {
    const prisma = createPrisma();
    prisma.suite.findMany.mockResolvedValue([
      {
        ...suiteRow,
        id: 'suite-1',
        cases: [{ ...automatedCase, id: 'case-2', suiteId: 'suite-1' }],
      },
      {
        ...suiteRow,
        id: 'suite-2',
        cases: [{ ...automatedCase, id: 'case-3', suiteId: 'suite-2' }],
      },
    ]);

    const [suiteA, suiteB] = await build(prisma).list(owner);

    expect(suiteA.cases[0].healthSignals).toContain('duplicate-key');
    expect(suiteB.cases[0].healthSignals).toContain('duplicate-key');
  });

  it('finds a project-wide duplicate key outside the current suite on a single-suite read', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue({
      ...suiteRow,
      cases: [automatedCase],
    });
    prisma.testCase.findMany.mockResolvedValue([
      {
        id: 'case-elsewhere',
        suiteId: 'suite-9',
        projectId: 'project-1',
        automationKey: 'checkout_pay',
      },
    ]);

    const result = await build(prisma).findOne(owner, 'suite-1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cases[0].healthSignals).toContain('duplicate-key');
    expect(prisma.testCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: { in: ['project-1'] },
          automationKey: { in: ['checkout_pay'] },
        },
      }),
    );
  });

  it('scopes the last-six flaky window to the batch of automated case ids', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue({
      ...suiteRow,
      cases: [automatedCase],
    });

    await build(prisma).findOne(owner, 'suite-1');

    const [[sqlArg]] = prisma.$queryRaw.mock.calls as [
      [{ sql: string; values: unknown[] }],
    ];
    expect(sqlArg.sql).toContain('PARTITION BY rc."testCaseId"');
    expect(sqlArg.sql).toContain('rn <=');
    expect(sqlArg.sql).toContain(
      "rc.status IN ('pass', 'fail', 'skip', 'blocked')",
    );
    expect(sqlArg.sql).toContain('r."finishedAt" IS NOT NULL');
    expect(sqlArg.values).toContain('case-2');
    expect(sqlArg.values).toContain(6);
  });

  it('derives flaky from the last six results, newest first', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue({
      ...suiteRow,
      cases: [automatedCase],
    });
    prisma.$queryRaw.mockResolvedValue([
      { test_case_id: 'case-2', status: 'pass' },
      { test_case_id: 'case-2', status: 'fail' },
      { test_case_id: 'case-2', status: 'pass' },
    ]);

    const result = await build(prisma).findOne(owner, 'suite-1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cases[0].healthSignals).toContain('flaky');
  });
});

describe('SuitesService.update name source', () => {
  it('marks the name as chosen by a person when the update renames the suite', async () => {
    const prisma = createPrisma();

    await build(prisma).update(owner, 'suite-1', { name: 'Payments' });

    expect(prisma.suite.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'Payments', nameSource: 'human' },
      }),
    );
  });

  it('leaves the name source alone when only other fields change', async () => {
    const prisma = createPrisma();

    await build(prisma).update(owner, 'suite-1', { description: 'Pagos' });

    expect(prisma.suite.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { description: 'Pagos' } }),
    );
  });

  it('leaves the name source alone when the patch repeats the current name unchanged', async () => {
    const prisma = createPrisma();

    await build(prisma).update(owner, 'suite-1', {
      name: 'Checkout',
      description: 'Pagos',
    });

    expect(prisma.suite.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'Checkout', description: 'Pagos' },
      }),
    );
  });

  it('compares against the locked row inside the transaction, not the stale pre-transaction read', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue({ ...suiteRow, name: 'Checkout' });
    prisma.$queryRaw.mockResolvedValue([{ name: 'RenamedConcurrently' }]);

    await build(prisma).update(owner, 'suite-1', { name: 'Checkout' });

    expect(prisma.suite.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'Checkout', nameSource: 'human' },
      }),
    );
  });

  it('leaves the name source alone when the locked row already carries the patched name', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue({ ...suiteRow, name: 'Stale' });
    prisma.$queryRaw.mockResolvedValue([{ name: 'Checkout' }]);

    await build(prisma).update(owner, 'suite-1', { name: 'Checkout' });

    expect(prisma.suite.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'Checkout' },
      }),
    );
  });
});

describe('SuitesService documented locale', () => {
  it('exposes the locale of the published version on each case', async () => {
    const prisma = createPrisma();
    prisma.suite.findMany.mockResolvedValue([
      {
        ...suiteRow,
        cases: [
          {
            ...suiteRow.cases[0],
            currentVersion: { version: 3, locale: 'es' },
          },
        ],
      },
    ]);

    const [suite] = await build(prisma).list(owner);

    expect(suite.cases[0].documentedLocale).toBe('es');
  });

  it('reports null when the case has no published version or the version predates locale stamping', async () => {
    const prisma = createPrisma();
    prisma.suite.findMany.mockResolvedValue([suiteRow]);

    const [suite] = await build(prisma).list(owner);

    expect(suite.cases[0].documentedLocale).toBeNull();
  });
});

describe('SuitesService stale-locale read model', () => {
  function automatedCase(id: string, overrides: Record<string, unknown> = {}) {
    return {
      id,
      suiteId: 'suite-1',
      name: `Case ${id}`,
      steps: ['open'],
      expectedResult: 'done',
      priority: 'medium' as const,
      state: 'active' as const,
      currentVersion: { version: 1, locale: 'en' },
      executionMode: 'automated' as const,
      automationKey: `key-${id}`,
      automationClassName: null,
      automationFilePath: null,
      ...overrides,
    };
  }

  it('marks each automated case as locale-stale using only the org default locale, never a viewer locale', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue({ user: { locale: 'en' } });
    prisma.suite.findMany.mockResolvedValue([
      {
        ...suiteRow,
        cases: [
          automatedCase('fresh', {
            currentVersion: { version: 1, locale: 'en' },
          }),
          automatedCase('stale-other-locale', {
            currentVersion: { version: 1, locale: 'es' },
          }),
          automatedCase('stale-null-locale', { currentVersion: null }),
          {
            ...suiteRow.cases[0],
            id: 'manual-mismatch',
            currentVersion: { version: 1, locale: 'es' },
          },
        ],
      },
    ]);

    const [suite] = await build(prisma).list(owner);
    const byId = new Map(suite.cases.map((c) => [c.id, c]));

    expect(byId.get('fresh')?.localeStale).toBe(false);
    expect(byId.get('stale-other-locale')?.localeStale).toBe(true);
    expect(byId.get('stale-null-locale')?.localeStale).toBe(true);
  });

  it('counts staleLocaleCount over automated cases only, matching the extraction candidate predicate exactly', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue({ user: { locale: 'en' } });
    const cases = [
      automatedCase('fresh', { currentVersion: { version: 1, locale: 'en' } }),
      automatedCase('stale-1', {
        currentVersion: { version: 1, locale: 'es' },
      }),
      automatedCase('stale-2', { currentVersion: null }),
      {
        ...suiteRow.cases[0],
        id: 'manual-stale-looking',
        currentVersion: { version: 1, locale: 'es' },
      },
    ];
    prisma.suite.findMany.mockResolvedValue([{ ...suiteRow, cases }]);

    const [suite] = await build(prisma).list(owner);

    const expectedCount = cases.filter(
      (row) =>
        row.executionMode === 'automated' &&
        row.steps.length > 0 &&
        (row.currentVersion === null || row.currentVersion.locale !== 'en'),
    ).length;

    expect(suite.staleLocaleCount).toBe(expectedCount);
    expect(suite.staleLocaleCount).toBe(2);
  });
});
