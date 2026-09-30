import {
  createCaseNameStore,
  type CaseNameStore,
  type StoredCase,
} from '../../../../test/support/case-name-store';
import {
  testCaseAutomationKeyViolation,
  testCaseNameViolation,
  testCaseVersionViolation,
} from '../../../../test/support/prisma-unique-violation';
import type { PublishTestCaseVersionFields } from './publish-test-case-version';
import {
  publishWithNameFallback,
  type NameFallbackTx,
} from './publish-with-name-fallback';

const SUITE_ID = 'suite-1';
const TAKEN_TITLE = 'Adds an item to the cart';

function storedCase(id: string, name: string, key: string): StoredCase {
  return { id, suiteId: SUITE_ID, name, automationKey: key };
}

function seedCases(): StoredCase[] {
  return [
    storedCase('case-1', 'Old name one', 'Cart > one'),
    storedCase('case-2', 'Old name two', 'Cart > two'),
    storedCase('case-3', 'Old name three', 'Cart > three'),
    storedCase('case-9', TAKEN_TITLE, 'Cart > ghost'),
  ];
}

function fieldsFor(title: string): PublishTestCaseVersionFields {
  return {
    title,
    objective: 'Verify the cart total updates',
    preconditions: [],
    steps: ['Add one item'],
    expectedResult: 'The total reflects the item price',
    priority: 'medium',
    locale: 'en',
  };
}

function publishInput(
  store: CaseNameStore,
  testCaseId: string,
  title: string,
  overrides: Record<string, unknown> = { documentationSource: 'aeris' },
) {
  const row = store.committed().cases.find((c) => c.id === testCaseId);

  return {
    testCaseId,
    suiteId: SUITE_ID,
    automationKey: row?.automationKey ?? 'unknown',
    currentName: row?.name ?? 'unknown',
    fields: fieldsFor(title),
    overrides,
  };
}

function logger() {
  return { warn: jest.fn() };
}

function nameOf(store: CaseNameStore, id: string): string | undefined {
  return store.committed().cases.find((c) => c.id === id)?.name;
}

describe('publishWithNameFallback', () => {
  it('publishes under the Aeris title and releases its savepoint when nothing collides', async () => {
    const store = createCaseNameStore(seedCases());
    const log = logger();

    await store.transaction((tx) =>
      publishWithNameFallback(
        tx as unknown as NameFallbackTx,
        publishInput(store, 'case-1', 'Adds one item'),
        log,
      ),
    );

    expect(nameOf(store, 'case-1')).toBe('Adds one item');
    expect(store.statements).toEqual([
      'SAVEPOINT case_publish',
      'RELEASE SAVEPOINT case_publish',
    ]);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('returns the published version', async () => {
    const store = createCaseNameStore(seedCases());

    const published = await store.transaction((tx) =>
      publishWithNameFallback(
        tx as unknown as NameFallbackTx,
        publishInput(store, 'case-1', 'Adds one item'),
        logger(),
      ),
    );

    expect(published).toEqual({ id: 'case-1-v1', version: 1 });
  });

  it('keeps the current name and still writes the Aeris title in the new version when the title is taken', async () => {
    const store = createCaseNameStore(seedCases());

    await store.transaction((tx) =>
      publishWithNameFallback(
        tx as unknown as NameFallbackTx,
        publishInput(store, 'case-1', TAKEN_TITLE),
        logger(),
      ),
    );

    const state = store.committed();
    expect(nameOf(store, 'case-1')).toBe('Old name one');
    expect(state.versions).toEqual([
      { testCaseId: 'case-1', version: 1, title: TAKEN_TITLE },
    ]);
  });

  it('rolls back to the savepoint before retrying, in order', async () => {
    const store = createCaseNameStore(seedCases());

    await store.transaction((tx) =>
      publishWithNameFallback(
        tx as unknown as NameFallbackTx,
        publishInput(store, 'case-1', TAKEN_TITLE),
        logger(),
      ),
    );

    expect(store.statements).toEqual([
      'SAVEPOINT case_publish',
      'ROLLBACK TO SAVEPOINT case_publish',
      'RELEASE SAVEPOINT case_publish',
    ]);
  });

  it('keeps every other override on the retry', async () => {
    const store = createCaseNameStore(seedCases());

    await store.transaction((tx) =>
      publishWithNameFallback(
        tx as unknown as NameFallbackTx,
        publishInput(store, 'case-1', TAKEN_TITLE, {
          documentationSource: 'aeris',
          documentationOutcome: 'complete',
        }),
        logger(),
      ),
    );

    const row = store.committed().cases.find((c) => c.id === 'case-1');
    expect(row?.fields).toMatchObject({
      documentationSource: 'aeris',
      documentationOutcome: 'complete',
      objective: 'Verify the cart total updates',
    });
  });

  it('retries with the case current name so the retry cannot collide', async () => {
    const store = createCaseNameStore(seedCases());

    await store.transaction((tx) =>
      publishWithNameFallback(
        tx as unknown as NameFallbackTx,
        publishInput(store, 'case-1', TAKEN_TITLE),
        logger(),
      ),
    );

    const updates = store.tx.testCase.update.mock.calls.map(
      ([args]) => args.data.name,
    );
    expect(updates).toEqual([TAKEN_TITLE, 'Old name one']);
  });

  it('warns with the case key, the proposed title and the case that holds it', async () => {
    const store = createCaseNameStore(seedCases());
    const log = logger();

    await store.transaction((tx) =>
      publishWithNameFallback(
        tx as unknown as NameFallbackTx,
        publishInput(store, 'case-1', TAKEN_TITLE),
        log,
      ),
    );

    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledWith(
      `Kept the current name "Old name one" of case case-1 (key "Cart > one"): the proposed title "${TAKEN_TITLE}" is already held by case case-9 (key "Cart > ghost")`,
    );
  });

  it('warns that the holder could not be identified when it is not visible', async () => {
    const store = createCaseNameStore(seedCases());
    store.tx.testCase.findFirst.mockResolvedValueOnce(null);
    const log = logger();

    await store.transaction((tx) =>
      publishWithNameFallback(
        tx as unknown as NameFallbackTx,
        publishInput(store, 'case-1', TAKEN_TITLE),
        log,
      ),
    );

    expect(log.warn).toHaveBeenCalledWith(
      `Kept the current name "Old name one" of case case-1 (key "Cart > one"): the proposed title "${TAKEN_TITLE}" is already held by a case that could not be identified`,
    );
  });

  it('warns without a key when the holder has none', async () => {
    const store = createCaseNameStore(seedCases());
    store.tx.testCase.findFirst.mockResolvedValueOnce({
      id: 'case-9',
      suiteId: SUITE_ID,
      name: TAKEN_TITLE,
      automationKey: null,
    });
    const log = logger();

    await store.transaction((tx) =>
      publishWithNameFallback(
        tx as unknown as NameFallbackTx,
        publishInput(store, 'case-1', TAKEN_TITLE),
        log,
      ),
    );

    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('held by case case-9 (key none)'),
    );
  });

  it('falls back for a second consecutive collision in the same transaction', async () => {
    const store = createCaseNameStore([
      ...seedCases(),
      storedCase('case-8', 'Removes an item from the cart', 'Cart > ghost 2'),
    ]);

    await store.transaction(async (tx) => {
      const client = tx as unknown as NameFallbackTx;
      await publishWithNameFallback(
        client,
        publishInput(store, 'case-1', TAKEN_TITLE),
        logger(),
      );
      await publishWithNameFallback(
        client,
        publishInput(store, 'case-2', 'Removes an item from the cart'),
        logger(),
      );
      await publishWithNameFallback(
        client,
        publishInput(store, 'case-3', 'Clears the cart'),
        logger(),
      );
    });

    expect(nameOf(store, 'case-1')).toBe('Old name one');
    expect(nameOf(store, 'case-2')).toBe('Old name two');
    expect(nameOf(store, 'case-3')).toBe('Clears the cart');
    expect(store.committed().versions.map((v) => v.testCaseId)).toEqual([
      'case-1',
      'case-2',
      'case-3',
    ]);
  });

  it('does not touch a case published earlier in the same transaction', async () => {
    const store = createCaseNameStore(seedCases());

    await store.transaction(async (tx) => {
      const client = tx as unknown as NameFallbackTx;
      await publishWithNameFallback(
        client,
        publishInput(store, 'case-1', 'Adds one item'),
        logger(),
      );
      await publishWithNameFallback(
        client,
        publishInput(store, 'case-2', TAKEN_TITLE),
        logger(),
      );
    });

    expect(nameOf(store, 'case-1')).toBe('Adds one item');
    expect(nameOf(store, 'case-2')).toBe('Old name two');
  });

  it('falls back when two cases of one job propose the same title', async () => {
    const store = createCaseNameStore(seedCases());

    await store.transaction(async (tx) => {
      const client = tx as unknown as NameFallbackTx;
      await publishWithNameFallback(
        client,
        publishInput(store, 'case-1', 'Shared title'),
        logger(),
      );
      await publishWithNameFallback(
        client,
        publishInput(store, 'case-2', 'Shared title'),
        logger(),
      );
    });

    expect(nameOf(store, 'case-1')).toBe('Shared title');
    expect(nameOf(store, 'case-2')).toBe('Old name two');
  });

  it('rethrows a unique violation on the automation key without retrying', async () => {
    const store = createCaseNameStore(seedCases());
    const violation = testCaseAutomationKeyViolation();
    store.failUpdatesOf('case-1', violation);

    await expect(
      store.transaction((tx) =>
        publishWithNameFallback(
          tx as unknown as NameFallbackTx,
          publishInput(store, 'case-1', 'Adds one item'),
          logger(),
        ),
      ),
    ).rejects.toBe(violation);

    expect(store.tx.testCase.update).toHaveBeenCalledTimes(1);
    expect(store.statements).not.toContain(
      'ROLLBACK TO SAVEPOINT case_publish',
    );
  });

  it('rethrows a unique violation on the version index without retrying', async () => {
    const store = createCaseNameStore(seedCases());
    const violation = testCaseVersionViolation();
    store.failUpdatesOf('case-1', violation);

    await expect(
      store.transaction((tx) =>
        publishWithNameFallback(
          tx as unknown as NameFallbackTx,
          publishInput(store, 'case-1', 'Adds one item'),
          logger(),
        ),
      ),
    ).rejects.toBe(violation);

    expect(store.tx.testCase.update).toHaveBeenCalledTimes(1);
  });

  it('rethrows an error that is not a unique violation', async () => {
    const store = createCaseNameStore(seedCases());
    const failure = new Error('deadlock detected');
    store.failUpdatesOf('case-1', failure);

    await expect(
      store.transaction((tx) =>
        publishWithNameFallback(
          tx as unknown as NameFallbackTx,
          publishInput(store, 'case-1', 'Adds one item'),
          logger(),
        ),
      ),
    ).rejects.toBe(failure);

    expect(store.tx.testCase.update).toHaveBeenCalledTimes(1);
  });

  it('rethrows an error raised by the retry itself', async () => {
    const store = createCaseNameStore(seedCases());
    const failure = new Error('deadlock detected');
    store.failUpdatesOf('case-1', testCaseNameViolation(), failure);

    await expect(
      store.transaction((tx) =>
        publishWithNameFallback(
          tx as unknown as NameFallbackTx,
          publishInput(store, 'case-1', TAKEN_TITLE),
          logger(),
        ),
      ),
    ).rejects.toBe(failure);
  });

  it('leaves the committed state untouched when the error is rethrown', async () => {
    const store = createCaseNameStore(seedCases());
    store.failUpdatesOf('case-1', new Error('deadlock detected'));

    await store
      .transaction((tx) =>
        publishWithNameFallback(
          tx as unknown as NameFallbackTx,
          publishInput(store, 'case-1', 'Adds one item'),
          logger(),
        ),
      )
      .catch(() => undefined);

    expect(store.committed().versions).toEqual([]);
    expect(nameOf(store, 'case-1')).toBe('Old name one');
  });
});
