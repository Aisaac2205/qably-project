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
