import { OfficialCaseReconciler } from './official-case-reconciler';

interface FakeCollisionTx {
  caseIdentityCollision: {
    upsert: jest.Mock;
    updateMany: jest.Mock;
  };
}

function createCollisionTx(): FakeCollisionTx {
  return {
    caseIdentityCollision: {
      upsert: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

function createReconcileTx() {
  return {
    testCase: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $executeRawUnsafe: jest.fn(),
  };
}

describe('OfficialCaseReconciler.reconcile collision signals', () => {
  it('returns empty identityKeys and legacyKeys when every case resolves without ambiguity', async () => {
    const tx = createReconcileTx();
    tx.testCase.findMany.mockResolvedValueOnce([]).mockResolvedValue([
      { id: 'case-1', automationKey: 'Adds to cart' },
      { id: 'case-2', automationKey: 'Removes from cart' },
    ]);

    const result = await new OfficialCaseReconciler().reconcile(
      tx as never,
      'suite-1',
      'project-1',
      [{ name: 'Adds to cart' }, { name: 'Removes from cart' }],
    );

    expect(result.identityKeys).toEqual([]);
    expect(result.legacyKeys).toEqual([]);
  });

  it('reports an identity collision when two cases in the same report resolve to the same composite key', async () => {
    const tx = createReconcileTx();

    const result = await new OfficialCaseReconciler().reconcile(
      tx as never,
      'suite-1',
      'project-1',
      [
        { name: 'tests.checkout.test_checkout::test_add_item' },
        { name: 'test_add_item', className: 'tests.checkout.test_checkout' },
      ],
    );

    expect(result.identityKeys).toEqual([
      { key: 'tests.checkout.test_checkout::test_add_item', count: 2 },
    ]);
  });

  it('reports a legacy-key collision when two composites share a bare name from different classnames', async () => {
    const tx = createReconcileTx();

    const result = await new OfficialCaseReconciler().reconcile(
      tx as never,
      'suite-1',
      'project-1',
      [
        { name: 'test_add_item', className: 'tests.checkout.a' },
        { name: 'test_add_item', className: 'tests.checkout.b' },
      ],
    );

    expect(result.legacyKeys).toEqual([{ key: 'test_add_item', count: 2 }]);
  });
});

function catalogRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Case ${id}`,
    steps: [`Step of ${id}`],
    expectedResult: `Result of ${id}`,
    currentVersionId: null,
    currentVersion: null,
    ...overrides,
  };
}

function suiteRow(
  id: string,
  automationKey: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    name: automationKey,
    automationKey,
    automationClassName: null,
    automationFilePath: null,
    executionMode: 'automated',
    ...overrides,
  };
}

describe('OfficialCaseReconciler.reconcile catalog content', () => {
  it('returns the content of every matched case from one extra query', async () => {
    const tx = createReconcileTx();
    tx.testCase.findMany
      .mockResolvedValueOnce([
        suiteRow('case-1', 'Adds to cart'),
        suiteRow('case-2', 'Removes from cart'),
        suiteRow('case-3', 'Not reported in this run'),
      ])
      .mockResolvedValueOnce([
        catalogRow('case-1', {
          currentVersionId: 'version-7',
          currentVersion: { version: 7 },
        }),
        catalogRow('case-2'),
      ]);

    const result = await new OfficialCaseReconciler().reconcile(
      tx as never,
      'suite-1',
      'project-1',
      [{ name: 'Adds to cart' }, { name: 'Removes from cart' }],
    );

    expect(tx.testCase.findMany).toHaveBeenCalledTimes(2);
    expect(tx.testCase.findMany).toHaveBeenLastCalledWith({
      where: { id: { in: ['case-1', 'case-2'] } },
      select: {
        id: true,
        name: true,
        steps: true,
        expectedResult: true,
        currentVersionId: true,
        currentVersion: { select: { version: true } },
      },
    });
    expect([...result.catalogByCaseId.keys()].sort()).toEqual([
      'case-1',
      'case-2',
    ]);
    expect(result.catalogByCaseId.get('case-1')).toEqual(
      catalogRow('case-1', {
        currentVersionId: 'version-7',
        currentVersion: { version: 7 },
      }),
    );
  });

  it('carries no version for a case that has none in force', async () => {
    const tx = createReconcileTx();
    tx.testCase.findMany
      .mockResolvedValueOnce([suiteRow('case-1', 'Adds to cart')])
      .mockResolvedValueOnce([catalogRow('case-1')]);

    const result = await new OfficialCaseReconciler().reconcile(
      tx as never,
      'suite-1',
      'project-1',
      [{ name: 'Adds to cart' }],
    );

    const matched = result.catalogByCaseId.get('case-1');
    expect(matched?.currentVersionId).toBeNull();
    expect(matched?.currentVersion).toBeNull();
  });

  it('returns the content of a newly created draft alongside the matched cases', async () => {
    const tx = createReconcileTx();
    tx.testCase.findMany
      .mockResolvedValueOnce([suiteRow('case-1', 'Adds to cart')])
      .mockResolvedValueOnce([
        { id: 'draft-1', automationKey: 'Brand new case' },
      ])
      .mockResolvedValueOnce([
        catalogRow('case-1', {
          currentVersionId: 'version-2',
          currentVersion: { version: 2 },
        }),
        catalogRow('draft-1', { name: 'Brand new case', steps: [] }),
      ]);

    const result = await new OfficialCaseReconciler().reconcile(
      tx as never,
      'suite-1',
      'project-1',
      [{ name: 'Adds to cart' }, { name: 'Brand new case' }],
    );

    expect(result.createdCaseIds).toEqual(['draft-1']);
    expect(tx.testCase.findMany).toHaveBeenCalledTimes(3);
    expect(tx.testCase.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: { in: ['case-1', 'draft-1'] } },
      }),
    );
    expect(result.catalogByCaseId.get('draft-1')).toEqual(
      catalogRow('draft-1', { name: 'Brand new case', steps: [] }),
    );
    expect(result.catalogByCaseId.get('case-1')?.currentVersionId).toBe(
      'version-2',
    );
  });

  it('skips the content query when no reported case resolves to a catalog case', async () => {
    const tx = createReconcileTx();
    tx.testCase.findMany.mockResolvedValue([]);

    const result = await new OfficialCaseReconciler().reconcile(
      tx as never,
      'suite-1',
      'project-1',
      [
        { name: 'tests.checkout.test_checkout::test_add_item' },
        { name: 'test_add_item', className: 'tests.checkout.test_checkout' },
      ],
    );

    expect(result.catalogByCaseId.size).toBe(0);
    expect(tx.testCase.findMany).toHaveBeenCalledTimes(1);
  });
});

interface UpsertCallArg {
  where: { suiteId_kind_key: { suiteId: string; kind: string; key: string } };
  create: {
    projectId: string;
    suiteId: string;
    kind: string;
    key: string;
    claimantCount: number;
    firstSeenAt: Date;
    lastSeenAt: Date;
    lastRunId: string;
  };
  update: {
    claimantCount: number;
    lastSeenAt: Date;
    lastRunId: string;
    closedAt: null;
  };
}

interface UpdateManyCallArg {
  where: {
    suiteId: string;
    kind: string;
    key: { in: string[] };
    closedAt: null;
  };
  data: { closedAt: Date };
}

function lastUpsertCall(tx: FakeCollisionTx): UpsertCallArg {
  const calls = tx.caseIdentityCollision.upsert.mock.calls as UpsertCallArg[][];
  return calls[calls.length - 1][0];
}

function lastUpdateManyCall(tx: FakeCollisionTx): UpdateManyCallArg {
  const calls = tx.caseIdentityCollision.updateMany.mock
    .calls as UpdateManyCallArg[][];
  return calls[calls.length - 1][0];
}

describe('OfficialCaseReconciler.syncCollisions upsert-open', () => {
  it('upserts an open identity-kind row for every colliding identity key from this ingest', async () => {
    const tx = createCollisionTx();

    await new OfficialCaseReconciler().syncCollisions(
      tx,
      'project-1',
      'suite-1',
      'run-1',
      [{ key: 'checkout::test_add_item', count: 2 }],
      [],
      [],
      [],
    );

    const call = lastUpsertCall(tx);
    expect(call.where).toEqual({
      suiteId_kind_key: {
        suiteId: 'suite-1',
        kind: 'identity',
        key: 'checkout::test_add_item',
      },
    });
    expect(call.create.projectId).toBe('project-1');
    expect(call.create.suiteId).toBe('suite-1');
    expect(call.create.kind).toBe('identity');
    expect(call.create.key).toBe('checkout::test_add_item');
    expect(call.create.claimantCount).toBe(2);
    expect(call.create.lastRunId).toBe('run-1');
    expect(call.update.claimantCount).toBe(2);
    expect(call.update.lastRunId).toBe('run-1');
    expect(call.update.closedAt).toBeNull();
  });

  it('upserts an open legacy_key-kind row for every colliding legacy key from this ingest', async () => {
    const tx = createCollisionTx();

    await new OfficialCaseReconciler().syncCollisions(
      tx,
      'project-1',
      'suite-1',
      'run-1',
      [],
      [{ key: 'test_add_item', count: 3 }],
      [],
      [],
    );

    const call = lastUpsertCall(tx);
    expect(call.where).toEqual({
      suiteId_kind_key: {
        suiteId: 'suite-1',
        kind: 'legacy_key',
        key: 'test_add_item',
      },
    });
    expect(call.create.claimantCount).toBe(3);
    expect(call.update.claimantCount).toBe(3);
    expect(call.update.closedAt).toBeNull();
  });

  it('reopens a previously closed collision row that collides again, rather than leaving it closed', async () => {
    const tx = createCollisionTx();

    await new OfficialCaseReconciler().syncCollisions(
      tx,
      'project-1',
      'suite-1',
      'run-2',
      [{ key: 'checkout::test_add_item', count: 2 }],
      [],
      [],
      [],
    );

    expect(lastUpsertCall(tx).update.closedAt).toBeNull();
  });
});

describe('OfficialCaseReconciler.syncCollisions auto-close on unambiguous ingest', () => {
  it('closes an open identity collision whose key resolved to a real case this ingest', async () => {
    const tx = createCollisionTx();

    await new OfficialCaseReconciler().syncCollisions(
      tx,
      'project-1',
      'suite-1',
      'run-3',
      [],
      [],
      ['checkout::test_add_item'],
      [],
    );

    const call = lastUpdateManyCall(tx);
    expect(call.where).toEqual({
      suiteId: 'suite-1',
      kind: 'identity',
      key: { in: ['checkout::test_add_item'] },
      closedAt: null,
    });
    expect(call.data.closedAt).toBeInstanceOf(Date);
  });

  it('closes an open legacy-key collision whose key resolved unambiguously this ingest', async () => {
    const tx = createCollisionTx();

    await new OfficialCaseReconciler().syncCollisions(
      tx,
      'project-1',
      'suite-1',
      'run-3',
      [],
      [],
      [],
      ['test_add_item'],
    );

    const call = lastUpdateManyCall(tx);
    expect(call.where).toEqual({
      suiteId: 'suite-1',
      kind: 'legacy_key',
      key: { in: ['test_add_item'] },
      closedAt: null,
    });
    expect(call.data.closedAt).toBeInstanceOf(Date);
  });

  it('never closes a key that is absent from this report — it stays open untouched', async () => {
    const tx = createCollisionTx();

    await new OfficialCaseReconciler().syncCollisions(
      tx,
      'project-1',
      'suite-1',
      'run-3',
      [],
      [],
      [],
      [],
    );

    expect(tx.caseIdentityCollision.updateMany).not.toHaveBeenCalled();
  });
});
