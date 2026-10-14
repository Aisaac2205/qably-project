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
      {
        key: 'tests.checkout.test_checkout::test_add_item',
        count: 2,
        claimants: [
          'tests.checkout.test_checkout::test_add_item',
          'tests.checkout.test_checkout › test_add_item',
        ],
      },
    ]);
  });

  it('reports a legacy-key collision when two composites share a bare name and the suite holds a row keyed by that bare name', async () => {
    const tx = createReconcileTx();
    tx.testCase.findMany.mockResolvedValueOnce([
      {
        id: 'legacy-1',
        name: 'test_add_item',
        automationKey: 'test_add_item',
        executionMode: 'automated',
      },
    ]);

    const result = await new OfficialCaseReconciler().reconcile(
      tx as never,
      'suite-1',
      'project-1',
      [
        { name: 'test_add_item', className: 'tests.checkout.a' },
        { name: 'test_add_item', className: 'tests.checkout.b' },
      ],
    );

    expect(result.legacyKeys).toEqual([
      {
        key: 'test_add_item',
        count: 2,
        claimants: [
          'tests.checkout.a::test_add_item',
          'tests.checkout.b::test_add_item',
        ],
      },
    ]);
  });

  it('reports a legacy-key collision when the suite holds an unkeyed automated case named by that bare name', async () => {
    const tx = createReconcileTx();
    tx.testCase.findMany.mockResolvedValueOnce([
      {
        id: 'legacy-1',
        name: 'test_add_item',
        automationKey: null,
        executionMode: 'automated',
      },
    ]);

    const result = await new OfficialCaseReconciler().reconcile(
      tx as never,
      'suite-1',
      'project-1',
      [
        { name: 'test_add_item', className: 'tests.checkout.a' },
        { name: 'test_add_item', className: 'tests.checkout.b' },
      ],
    );

    expect(result.legacyKeys).toEqual([
      {
        key: 'test_add_item',
        count: 2,
        claimants: [
          'tests.checkout.a::test_add_item',
          'tests.checkout.b::test_add_item',
        ],
      },
    ]);
  });

  it('reports no legacy-key collision when two composites share a bare name but no suite row could be claimed by it', async () => {
    const tx = createReconcileTx();
    tx.testCase.findMany.mockResolvedValueOnce([
      {
        id: 'case-a',
        name: 'Adds an item',
        automationKey: 'tests.checkout.a::test_add_item',
        executionMode: 'automated',
      },
      {
        id: 'manual-1',
        name: 'test_add_item',
        automationKey: null,
        executionMode: 'manual',
      },
    ]);

    const result = await new OfficialCaseReconciler().reconcile(
      tx as never,
      'suite-1',
      'project-1',
      [
        { name: 'test_add_item', className: 'tests.checkout.a' },
        { name: 'test_add_item', className: 'tests.checkout.b' },
      ],
    );

    expect(result.legacyKeys).toEqual([]);
  });

  it('still reports a legacy-key collision when the report itself carries a plain case under that bare name', async () => {
    const tx = createReconcileTx();

    const result = await new OfficialCaseReconciler().reconcile(
      tx as never,
      'suite-1',
      'project-1',
      [
        { name: 'test_add_item' },
        { name: 'test_add_item', className: 'tests.checkout.a' },
      ],
    );

    expect(result.legacyKeys).toEqual([
      {
        key: 'test_add_item',
        count: 2,
        claimants: ['test_add_item', 'tests.checkout.a::test_add_item'],
      },
    ]);
  });

  it('keeps the composites off an unreachable bare name while still drafting each under its own key', async () => {
    const tx = createReconcileTx();

    await new OfficialCaseReconciler().reconcile(
      tx as never,
      'suite-1',
      'project-1',
      [
        { name: 'test_add_item', className: 'tests.checkout.a' },
        { name: 'test_add_item', className: 'tests.checkout.b' },
      ],
    );

    expect(tx.testCase.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          automationKey: 'tests.checkout.a::test_add_item',
        }),
        expect.objectContaining({
          automationKey: 'tests.checkout.b::test_add_item',
        }),
      ],
      skipDuplicates: true,
    });
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

// The real it.each titles of suite-list-query.service.spec.ts: the rows only
// differ after character 120, where the ingestion used to cut every name.
const ROWS_PREFIX =
  'SuiteListQueryService.page bounded reads reads the suites once, the case counts once and the run windows once for sort ';

function eachRow(sort: string) {
  const name = `${ROWS_PREFIX}${sort} and status all with 1 suites`;
  return { name, className: name };
}

function truncatedKey(name: string): string {
  return name.slice(0, 120);
}

describe('OfficialCaseReconciler.reconcile parametrized names past character 120', () => {
  it('matches and creates each row under its own full key, with no collision', async () => {
    const tx = createReconcileTx();
    const createdAt = eachRow('createdAt');
    const cases = eachRow('cases');
    tx.testCase.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'draft-1', automationKey: createdAt.name },
        { id: 'draft-2', automationKey: cases.name },
      ])
      .mockResolvedValue([]);

    const result = await new OfficialCaseReconciler().reconcile(
      tx as never,
      'suite-1',
      'project-1',
      [createdAt, cases],
    );

    expect(result.identityKeys).toEqual([]);
    expect(result.legacyKeys).toEqual([]);
    expect(result.caseIdByKey.get(createdAt.name)).toBe('draft-1');
    expect(result.caseIdByKey.get(cases.name)).toBe('draft-2');
    expect(tx.testCase.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ automationKey: createdAt.name }),
        expect.objectContaining({ automationKey: cases.name }),
      ],
      skipDuplicates: true,
    });
  });

  it('claims the catalog case keyed by the old truncated form and moves it to the full key', async () => {
    const tx = createReconcileTx();
    const row = eachRow('createdAt');
    tx.testCase.findMany
      .mockResolvedValueOnce([suiteRow('case-1', truncatedKey(row.name))])
      .mockResolvedValue([catalogRow('case-1')]);

    const result = await new OfficialCaseReconciler().reconcile(
      tx as never,
      'suite-1',
      'project-1',
      [row],
    );

    expect(result.caseIdByKey.get(row.name)).toBe('case-1');
    expect(tx.testCase.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: { automationKey: row.name },
    });
    expect(tx.testCase.createMany).not.toHaveBeenCalled();
    expect(result.createdCaseIds).toEqual([]);
  });

  it('claims the old truncated composite key of a pytest-style test', async () => {
    const tx = createReconcileTx();
    const name = `test_${'a'.repeat(200)}`;
    const ref = { name, className: 'tests.checkout' };
    tx.testCase.findMany
      .mockResolvedValueOnce([
        suiteRow('case-1', `tests.checkout::${name.slice(0, 120)}`),
      ])
      .mockResolvedValue([catalogRow('case-1')]);

    const result = await new OfficialCaseReconciler().reconcile(
      tx as never,
      'suite-1',
      'project-1',
      [ref],
    );

    expect(result.caseIdByKey.get(`tests.checkout::${name}`)).toBe('case-1');
    expect(tx.testCase.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: { automationKey: `tests.checkout::${name}` },
    });
  });

  it('leaves the old truncated case untouched when several rows share it, and creates each row on its own', async () => {
    const tx = createReconcileTx();
    const createdAt = eachRow('createdAt');
    const cases = eachRow('cases');
    tx.testCase.findMany
      .mockResolvedValueOnce([
        suiteRow('legacy-1', truncatedKey(createdAt.name)),
      ])
      .mockResolvedValueOnce([
        { id: 'draft-1', automationKey: createdAt.name },
        { id: 'draft-2', automationKey: cases.name },
      ])
      .mockResolvedValue([]);

    const result = await new OfficialCaseReconciler().reconcile(
      tx as never,
      'suite-1',
      'project-1',
      [createdAt, cases],
    );

    expect(result.identityKeys).toEqual([]);
    expect(result.legacyKeys).toEqual([]);
    expect([...result.caseIdByKey.values()].sort()).toEqual([
      'draft-1',
      'draft-2',
    ]);
    expect(tx.testCase.update).not.toHaveBeenCalled();
    expect(tx.testCase.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ automationKey: createdAt.name }),
        expect.objectContaining({ automationKey: cases.name }),
      ],
      skipDuplicates: true,
    });
  });

  it('does not take a case that is exactly the truncated key away from its own test', async () => {
    const tx = createReconcileTx();
    const long = eachRow('createdAt');
    const exact = { name: truncatedKey(long.name) };
    tx.testCase.findMany
      .mockResolvedValueOnce([suiteRow('case-exact', exact.name)])
      .mockResolvedValueOnce([{ id: 'draft-1', automationKey: long.name }])
      .mockResolvedValue([]);

    const result = await new OfficialCaseReconciler().reconcile(
      tx as never,
      'suite-1',
      'project-1',
      [long, exact],
    );

    expect(result.caseIdByKey.get(exact.name)).toBe('case-exact');
    expect(result.caseIdByKey.get(long.name)).toBe('draft-1');
    expect(tx.testCase.update).not.toHaveBeenCalled();
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
    claimants: string[];
    firstSeenAt: Date;
    lastSeenAt: Date;
    lastRunId: string;
  };
  update: {
    claimantCount: number;
    claimants: string[];
    lastSeenAt: Date;
    lastRunId: string;
    closedAt: null;
  };
}

interface UpdateManyCallArg {
  where: {
    suiteId: string;
    kind: string;
    key: { notIn: string[] };
    closedAt: null;
  };
  data: { closedAt: Date };
}

function lastUpsertCall(tx: FakeCollisionTx): UpsertCallArg {
  const calls = tx.caseIdentityCollision.upsert.mock.calls as UpsertCallArg[][];
  return calls[calls.length - 1][0];
}

function updateManyCall(tx: FakeCollisionTx, kind: string): UpdateManyCallArg {
  const calls = tx.caseIdentityCollision.updateMany.mock
    .calls as UpdateManyCallArg[][];
  const call = calls.find(([arg]) => arg.where.kind === kind);
  if (call === undefined) throw new Error(`no updateMany for kind ${kind}`);
  return call[0];
}

describe('OfficialCaseReconciler.syncCollisions upsert-open', () => {
  it('upserts an open identity-kind row for every colliding identity key from this ingest', async () => {
    const tx = createCollisionTx();

    await new OfficialCaseReconciler().syncCollisions(
      tx,
      'project-1',
      'suite-1',
      'run-1',
      [
        {
          key: 'checkout::test_add_item',
          count: 2,
          claimants: ['checkout::test_add_item', 'checkout › test_add_item'],
        },
      ],
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
    expect(call.create.claimants).toEqual([
      'checkout::test_add_item',
      'checkout › test_add_item',
    ]);
    expect(call.create.lastRunId).toBe('run-1');
    expect(call.update.claimantCount).toBe(2);
    expect(call.update.claimants).toEqual([
      'checkout::test_add_item',
      'checkout › test_add_item',
    ]);
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
      [{ key: 'test_add_item', count: 3, claimants: ['a::t', 'b::t', 'c::t'] }],
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
    expect(call.create.claimants).toEqual(['a::t', 'b::t', 'c::t']);
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
      [{ key: 'checkout::test_add_item', count: 2, claimants: [] }],
      [],
    );

    expect(lastUpsertCall(tx).update.closedAt).toBeNull();
  });
});

describe('OfficialCaseReconciler.syncCollisions auto-close', () => {
  it('closes every open identity collision when this report collides on nothing, including keys it no longer carries', async () => {
    const tx = createCollisionTx();

    await new OfficialCaseReconciler().syncCollisions(
      tx,
      'project-1',
      'suite-1',
      'run-3',
      [],
      [],
    );

    const call = updateManyCall(tx, 'identity');
    expect(call.where).toEqual({
      suiteId: 'suite-1',
      kind: 'identity',
      key: { notIn: [] },
      closedAt: null,
    });
    expect(call.data.closedAt).toBeInstanceOf(Date);
  });

  it('closes every open legacy-key collision when this report collides on none', async () => {
    const tx = createCollisionTx();

    await new OfficialCaseReconciler().syncCollisions(
      tx,
      'project-1',
      'suite-1',
      'run-3',
      [],
      [],
    );

    const call = updateManyCall(tx, 'legacy_key');
    expect(call.where).toEqual({
      suiteId: 'suite-1',
      kind: 'legacy_key',
      key: { notIn: [] },
      closedAt: null,
    });
    expect(call.data.closedAt).toBeInstanceOf(Date);
  });

  it('keeps open the keys this report still collides on, and closes only the others', async () => {
    const tx = createCollisionTx();

    await new OfficialCaseReconciler().syncCollisions(
      tx,
      'project-1',
      'suite-1',
      'run-3',
      [{ key: 'checkout::test_add_item', count: 2, claimants: [] }],
      [{ key: 'test_create', count: 2, claimants: [] }],
    );

    expect(updateManyCall(tx, 'identity').where.key).toEqual({
      notIn: ['checkout::test_add_item'],
    });
    expect(updateManyCall(tx, 'legacy_key').where.key).toEqual({
      notIn: ['test_create'],
    });
  });
});
