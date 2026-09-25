import type { OrgContext } from '../organizations/organizations.contracts';
import type { ProposalReclassifier } from '../proposal-classification/proposal-reclassifier';
import { SuiteCasesService } from './suite-cases.service';
import { SuiteViewAssembler } from './suite-view.assembler';

const owner: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'owner',
};

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
      objective: 'Verify the cart accepts a new item',
      preconditions: ['The cart is empty'],
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
    findFirst: jest.Mock;
    findUniqueOrThrow: jest.Mock;
  };
  testCase: {
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    findMany: jest.Mock;
  };
  runCase: { findMany: jest.Mock };
  extractedProposal: { findMany: jest.Mock };
  orgMember: { findFirst: jest.Mock };
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
}

function createPrisma(): FakePrisma {
  const prisma: FakePrisma = {
    suite: {
      findFirst: jest.fn().mockResolvedValue(suiteRow),
      findUniqueOrThrow: jest.fn().mockResolvedValue(suiteRow),
    },
    testCase: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    runCase: { findMany: jest.fn().mockResolvedValue([]) },
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

function fakeReclassifier(
  enqueue: jest.Mock = jest.fn().mockResolvedValue(undefined),
): ProposalReclassifier {
  return { enqueue } as unknown as ProposalReclassifier;
}

function build(
  prisma: FakePrisma,
  reclassifier: ProposalReclassifier = fakeReclassifier(),
) {
  return new SuiteCasesService(
    prisma as never,
    new SuiteViewAssembler(prisma as never),
    reclassifier,
  );
}

describe('SuiteCasesService case mutations', () => {
  const caseInput = {
    name: 'Removes from cart',
    objective: '',
    preconditions: [],
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

  it('forwards objective and preconditions to the created case', async () => {
    const prisma = createPrisma();

    await build(prisma).addCase(owner, 'suite-1', {
      ...caseInput,
      objective: 'Verify the cart accepts a new item',
      preconditions: ['The cart is empty'],
    });

    const [call] = prisma.testCase.create.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(call[0].data).toMatchObject({
      objective: 'Verify the cart accepts a new item',
      preconditions: ['The cart is empty'],
    });
  });

  it('forwards an objective and preconditions patch to the case update', async () => {
    const prisma = createPrisma();

    await build(prisma).updateCase(owner, 'suite-1', 'case-1', {
      objective: 'Verify the cart accepts a new item',
      preconditions: ['The cart is empty'],
    });

    expect(prisma.testCase.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: {
        objective: 'Verify the cart accepts a new item',
        preconditions: ['The cart is empty'],
      },
    });
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

  it('enqueues a reclassify job for the suite after a case is created', async () => {
    const prisma = createPrisma();
    const enqueue = jest.fn().mockResolvedValue(undefined);

    await build(prisma, fakeReclassifier(enqueue)).addCase(
      owner,
      'suite-1',
      caseInput,
    );

    expect(enqueue).toHaveBeenCalledWith('suite-1');
  });

  it('enqueues a reclassify job when a case is renamed', async () => {
    const prisma = createPrisma();
    const enqueue = jest.fn().mockResolvedValue(undefined);

    await build(prisma, fakeReclassifier(enqueue)).updateCase(
      owner,
      'suite-1',
      'case-1',
      { name: 'Adds two items to cart' },
    );

    expect(enqueue).toHaveBeenCalledWith('suite-1');
  });

  it('never enqueues a reclassify job when only non-identity fields change', async () => {
    const prisma = createPrisma();
    const enqueue = jest.fn().mockResolvedValue(undefined);

    await build(prisma, fakeReclassifier(enqueue)).updateCase(
      owner,
      'suite-1',
      'case-1',
      { objective: 'Verify the cart accepts a new item' },
    );

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('never enqueues a reclassify job when the case is not in the suite', async () => {
    const prisma = createPrisma();
    const enqueue = jest.fn().mockResolvedValue(undefined);

    await build(prisma, fakeReclassifier(enqueue)).updateCase(
      owner,
      'suite-1',
      'case-from-elsewhere',
      { name: 'Renamed' },
    );

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('never enqueues a reclassify job when a case is removed', async () => {
    const prisma = createPrisma();
    const enqueue = jest.fn().mockResolvedValue(undefined);

    await build(prisma, fakeReclassifier(enqueue)).removeCase(
      owner,
      'suite-1',
      'case-1',
    );

    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe('SuiteCasesService case promotion', () => {
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

describe('SuiteCasesService.updateCase documentation source', () => {
  it('marks the documentation as human-edited when the steps change', async () => {
    const prisma = createPrisma();

    await build(prisma).updateCase(owner, 'suite-1', 'case-1', {
      steps: ['open', 'add', 'checkout'],
    });

    expect(prisma.testCase.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: {
        steps: ['open', 'add', 'checkout'],
        documentationSource: 'human',
      },
    });
  });

  it('marks the documentation as human-edited when the name changes', async () => {
    const prisma = createPrisma();

    await build(prisma).updateCase(owner, 'suite-1', 'case-1', {
      name: 'Adds two items to the cart',
    });

    expect(prisma.testCase.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: {
        name: 'Adds two items to the cart',
        documentationSource: 'human',
      },
    });
  });

  it('marks the documentation as human-edited when the expected result changes', async () => {
    const prisma = createPrisma();

    await build(prisma).updateCase(owner, 'suite-1', 'case-1', {
      expectedResult: 'cart has two items',
    });

    expect(prisma.testCase.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: {
        expectedResult: 'cart has two items',
        documentationSource: 'human',
      },
    });
  });

  it('leaves the documentation source alone when the patch repeats the stored values', async () => {
    const prisma = createPrisma();

    await build(prisma).updateCase(owner, 'suite-1', 'case-1', {
      name: 'Adds to cart',
      steps: ['open', 'add'],
      expectedResult: 'cart has one item',
    });

    expect(prisma.testCase.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: {
        name: 'Adds to cart',
        steps: ['open', 'add'],
        expectedResult: 'cart has one item',
      },
    });
  });

  it('leaves the documentation source alone when only non-documented fields change', async () => {
    const prisma = createPrisma();

    await build(prisma).updateCase(owner, 'suite-1', 'case-1', {
      priority: 'high',
      state: 'active',
    });

    expect(prisma.testCase.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: { priority: 'high', state: 'active' },
    });
  });

  it('compares against the locked row inside the transaction, not the stale pre-transaction read', async () => {
    const prisma = createPrisma();
    prisma.$queryRaw.mockResolvedValue([
      { name: 'Adds to cart', steps: ['open', 'add'], expectedResult: 'stale' },
    ]);

    await build(prisma).updateCase(owner, 'suite-1', 'case-1', {
      expectedResult: 'stale',
    });

    expect(prisma.testCase.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: { expectedResult: 'stale' },
    });
  });
});
