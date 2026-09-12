import {
  isSameDocumentation,
  publishTestCaseVersion,
} from './publish-test-case-version';

function fields(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    title: 'Adds an item to the cart',
    objective: 'Verify the cart total updates',
    preconditions: ['The cart is empty'],
    steps: ['Add one item', 'Read the total'],
    expectedResult: 'The total reflects the item price',
    priority: 'medium' as const,
    locale: 'en',
    ...overrides,
  };
}

function fakeTx() {
  return {
    testCaseVersion: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'version-1', version: 1 }),
    },
    testCase: {
      update: jest.fn().mockResolvedValue({ id: 'case-1' }),
    },
  };
}

interface UpdateCallArgs {
  where: { id: string };
  data: Record<string, unknown>;
}

function lastCall<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as [T][];
  return calls[calls.length - 1][0];
}

describe('publishTestCaseVersion', () => {
  it('numbers the new version one past the count of existing versions', async () => {
    const tx = fakeTx();
    tx.testCaseVersion.count.mockResolvedValue(2);
    tx.testCaseVersion.create.mockResolvedValue({
      id: 'version-3',
      version: 3,
    });

    const result = await publishTestCaseVersion(tx, 'case-1', fields());

    const versionCall = lastCall<{ data: Record<string, unknown> }>(
      tx.testCaseVersion.create,
    );
    expect(versionCall.data).toMatchObject({
      testCaseId: 'case-1',
      version: 3,
    });
    expect(result).toEqual({ id: 'version-3', version: 3 });
  });

  it('carries every documentation field onto the version', async () => {
    const tx = fakeTx();

    await publishTestCaseVersion(tx, 'case-1', fields());

    const versionCall = lastCall<{ data: Record<string, unknown> }>(
      tx.testCaseVersion.create,
    );
    expect(versionCall.data).toMatchObject({
      title: 'Adds an item to the cart',
      objective: 'Verify the cart total updates',
      preconditions: ['The cart is empty'],
      steps: ['Add one item', 'Read the total'],
      expectedResult: 'The total reflects the item price',
      priority: 'medium',
      locale: 'en',
    });
  });

  it('points the case at the new version and mirrors title, steps and expectedResult', async () => {
    const tx = fakeTx();

    await publishTestCaseVersion(tx, 'case-1', fields());

    const updateCall = lastCall<UpdateCallArgs>(tx.testCase.update);
    expect(updateCall).toMatchObject({
      where: { id: 'case-1' },
      data: {
        currentVersionId: 'version-1',
        name: 'Adds an item to the cart',
        steps: ['Add one item', 'Read the total'],
        expectedResult: 'The total reflects the item price',
      },
    });
  });

  it('does not touch priority or state on the case unless explicitly overridden', async () => {
    const tx = fakeTx();

    await publishTestCaseVersion(tx, 'case-1', fields());

    const { data } = lastCall<UpdateCallArgs>(tx.testCase.update);
    expect(data).not.toHaveProperty('priority');
    expect(data).not.toHaveProperty('state');
  });

  it('merges case overrides such as priority, state and automation fields onto the case update', async () => {
    const tx = fakeTx();

    await publishTestCaseVersion(tx, 'case-1', fields(), {
      priority: 'high',
      state: 'active',
      executionMode: 'automated',
      automationKey: 'Cart > adds an item',
    });

    const { data } = lastCall<UpdateCallArgs>(tx.testCase.update);
    expect(data).toMatchObject({
      priority: 'high',
      state: 'active',
      executionMode: 'automated',
      automationKey: 'Cart > adds an item',
    });
  });
});

describe('isSameDocumentation', () => {
  function currentVersion(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      title: 'Adds an item to the cart',
      objective: 'Verify the cart total updates',
      preconditions: ['The cart is empty'],
      steps: ['Add one item', 'Read the total'],
      expectedResult: 'The total reflects the item price',
      priority: 'medium' as const,
      locale: 'en' as string | null,
      ...overrides,
    };
  }

  it('is false when there is no current version yet', () => {
    expect(isSameDocumentation(null, fields())).toBe(false);
  });

  it('is true when every documentation field matches the current version exactly', () => {
    expect(isSameDocumentation(currentVersion(), fields())).toBe(true);
  });

  it('is false when the title changed', () => {
    expect(
      isSameDocumentation(
        currentVersion({ title: 'Adds two items to the cart' }),
        fields(),
      ),
    ).toBe(false);
  });

  it('is false when the steps changed', () => {
    expect(
      isSameDocumentation(
        currentVersion({ steps: ['Add one item'] }),
        fields(),
      ),
    ).toBe(false);
  });

  it('is false when the steps have the same length but a different order', () => {
    expect(
      isSameDocumentation(
        currentVersion({ steps: ['Read the total', 'Add one item'] }),
        fields(),
      ),
    ).toBe(false);
  });

  it('is false when the locale changed', () => {
    expect(
      isSameDocumentation(currentVersion({ locale: 'es' }), fields()),
    ).toBe(false);
  });

  it('treats a null current locale and an undefined next locale as equal', () => {
    expect(
      isSameDocumentation(
        currentVersion({ locale: null }),
        fields({ locale: null }),
      ),
    ).toBe(true);
  });
});
