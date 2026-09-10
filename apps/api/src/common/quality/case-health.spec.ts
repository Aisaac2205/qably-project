import { deriveCaseHealth, type CaseHealthInput } from './case-health';

function baseCase(overrides: Partial<CaseHealthInput> = {}): CaseHealthInput {
  return {
    id: 'case-1',
    suiteId: 'suite-1',
    projectId: 'project-1',
    name: 'Adds to cart',
    automationKey: null,
    executionMode: 'manual',
    steps: [],
    recentResults: [],
    hasAnyRun: false,
    ...overrides,
  };
}

describe('deriveCaseHealth — no-steps', () => {
  it('flags an automated case with zero recorded steps', () => {
    const health = deriveCaseHealth([
      baseCase({ executionMode: 'automated', steps: [] }),
    ]);

    expect(health.get('case-1')).toContain('no-steps');
  });

  it('never flags a manual case with zero steps', () => {
    const health = deriveCaseHealth([
      baseCase({ executionMode: 'manual', steps: [] }),
    ]);

    expect(health.get('case-1')).not.toContain('no-steps');
  });

  it('never flags an automated case that has steps', () => {
    const health = deriveCaseHealth([
      baseCase({ executionMode: 'automated', steps: ['open', 'add'] }),
    ]);

    expect(health.get('case-1')).not.toContain('no-steps');
  });
});

describe('deriveCaseHealth — raw-name', () => {
  it('flags a name equal to its automation key', () => {
    const health = deriveCaseHealth([
      baseCase({
        name: 'checkout.spec > adds to cart',
        automationKey: 'checkout.spec > adds to cart',
      }),
    ]);

    expect(health.get('case-1')).toContain('raw-name');
  });

  it('flags a spaceless camelCase identifier-shaped name', () => {
    const health = deriveCaseHealth([baseCase({ name: 'addsToCart' })]);

    expect(health.get('case-1')).toContain('raw-name');
  });

  it('flags a spaceless snake_case identifier-shaped name', () => {
    const health = deriveCaseHealth([baseCase({ name: 'adds_to_cart' })]);

    expect(health.get('case-1')).toContain('raw-name');
  });

  it('flags a dotted identifier-shaped name', () => {
    const health = deriveCaseHealth([
      baseCase({ name: 'Checkout.AddsToCart' }),
    ]);

    expect(health.get('case-1')).toContain('raw-name');
  });

  it('never flags a plain lowercase word with no case or underscore mixing', () => {
    const health = deriveCaseHealth([baseCase({ name: 'checkout' })]);

    expect(health.get('case-1')).not.toContain('raw-name');
  });

  it('never flags a human-readable sentence name', () => {
    const health = deriveCaseHealth([
      baseCase({ name: 'Adds an item to the cart' }),
    ]);

    expect(health.get('case-1')).not.toContain('raw-name');
  });
});

describe('deriveCaseHealth — never-run', () => {
  it('flags an automated case with no run history at all', () => {
    const health = deriveCaseHealth([
      baseCase({ executionMode: 'automated', hasAnyRun: false }),
    ]);

    expect(health.get('case-1')).toContain('never-run');
  });

  it('never flags an automated case that has run at least once', () => {
    const health = deriveCaseHealth([
      baseCase({
        executionMode: 'automated',
        hasAnyRun: true,
        recentResults: ['pass'],
      }),
    ]);

    expect(health.get('case-1')).not.toContain('never-run');
  });

  it('never flags a manual case regardless of run history', () => {
    const health = deriveCaseHealth([
      baseCase({ executionMode: 'manual', hasAnyRun: false }),
    ]);

    expect(health.get('case-1')).not.toContain('never-run');
  });
});

describe('deriveCaseHealth — flaky', () => {
  it('is not flaky with only one recorded run', () => {
    const health = deriveCaseHealth([
      baseCase({
        executionMode: 'automated',
        hasAnyRun: true,
        recentResults: ['fail'],
      }),
    ]);

    expect(health.get('case-1')).not.toContain('flaky');
  });

  it('a monotonic run of failures is not flaky', () => {
    const health = deriveCaseHealth([
      baseCase({
        executionMode: 'automated',
        hasAnyRun: true,
        recentResults: ['fail', 'fail', 'fail', 'fail', 'fail', 'fail'],
      }),
    ]);

    expect(health.get('case-1')).not.toContain('flaky');
  });

  it('a single recovery (fail then five passes) is not flaky', () => {
    const health = deriveCaseHealth([
      baseCase({
        executionMode: 'automated',
        hasAnyRun: true,
        recentResults: ['pass', 'pass', 'pass', 'pass', 'pass', 'fail'],
      }),
    ]);

    expect(health.get('case-1')).not.toContain('flaky');
  });

  it('exactly one alternation is not flaky', () => {
    const health = deriveCaseHealth([
      baseCase({
        executionMode: 'automated',
        hasAnyRun: true,
        recentResults: ['pass', 'fail'],
      }),
    ]);

    expect(health.get('case-1')).not.toContain('flaky');
  });

  it('two alternations is flaky', () => {
    const health = deriveCaseHealth([
      baseCase({
        executionMode: 'automated',
        hasAnyRun: true,
        recentResults: ['pass', 'fail', 'pass'],
      }),
    ]);

    expect(health.get('case-1')).toContain('flaky');
  });

  it('is flaky over a full six-result window with alternating results', () => {
    const health = deriveCaseHealth([
      baseCase({
        executionMode: 'automated',
        hasAnyRun: true,
        recentResults: ['pass', 'fail', 'pass', 'fail', 'pass', 'fail'],
      }),
    ]);

    expect(health.get('case-1')).toContain('flaky');
  });

  it('ignores skip and blocked results when counting alternations', () => {
    const health = deriveCaseHealth([
      baseCase({
        executionMode: 'automated',
        hasAnyRun: true,
        recentResults: ['pass', 'skip', 'fail', 'blocked', 'pass'],
      }),
    ]);

    expect(health.get('case-1')).toContain('flaky');
  });
});

describe('deriveCaseHealth — duplicate-key', () => {
  it('flags two cases in different suites of the same project sharing an automation key', () => {
    const health = deriveCaseHealth([
      baseCase({
        id: 'case-1',
        suiteId: 'suite-1',
        projectId: 'project-1',
        automationKey: 'checkout > pay',
      }),
      baseCase({
        id: 'case-2',
        suiteId: 'suite-2',
        projectId: 'project-1',
        automationKey: 'checkout > pay',
      }),
    ]);

    expect(health.get('case-1')).toContain('duplicate-key');
    expect(health.get('case-2')).toContain('duplicate-key');
  });

  it('never flags cases with the same key in different projects', () => {
    const health = deriveCaseHealth([
      baseCase({
        id: 'case-1',
        projectId: 'project-1',
        automationKey: 'checkout > pay',
      }),
      baseCase({
        id: 'case-2',
        projectId: 'project-2',
        automationKey: 'checkout > pay',
      }),
    ]);

    expect(health.get('case-1')).not.toContain('duplicate-key');
    expect(health.get('case-2')).not.toContain('duplicate-key');
  });

  it('never flags a case with no automation key', () => {
    const health = deriveCaseHealth([
      baseCase({ id: 'case-1', automationKey: null }),
      baseCase({ id: 'case-2', automationKey: null }),
    ]);

    expect(health.get('case-1')).not.toContain('duplicate-key');
    expect(health.get('case-2')).not.toContain('duplicate-key');
  });

  it('never flags a unique key shared by no other case', () => {
    const health = deriveCaseHealth([
      baseCase({ id: 'case-1', automationKey: 'checkout > pay' }),
      baseCase({ id: 'case-2', automationKey: 'checkout > refund' }),
    ]);

    expect(health.get('case-1')).not.toContain('duplicate-key');
    expect(health.get('case-2')).not.toContain('duplicate-key');
  });
});

describe('deriveCaseHealth — near-duplicate-title', () => {
  it('flags two cases in the same suite with a normalized-equal title', () => {
    const health = deriveCaseHealth([
      baseCase({
        id: 'case-1',
        suiteId: 'suite-1',
        name: 'Adds an item to the cart',
      }),
      baseCase({
        id: 'case-2',
        suiteId: 'suite-1',
        name: 'adds an item to the cart',
      }),
    ]);

    expect(health.get('case-1')).toContain('near-duplicate-title');
    expect(health.get('case-2')).toContain('near-duplicate-title');
  });

  it('normalizes collapsed whitespace and stripped punctuation', () => {
    const health = deriveCaseHealth([
      baseCase({
        id: 'case-1',
        suiteId: 'suite-1',
        name: 'Adds an item, to the cart!',
      }),
      baseCase({
        id: 'case-2',
        suiteId: 'suite-1',
        name: '  Adds   an item to the cart  ',
      }),
    ]);

    expect(health.get('case-1')).toContain('near-duplicate-title');
    expect(health.get('case-2')).toContain('near-duplicate-title');
  });

  it('never flags a matching title in a different suite', () => {
    const health = deriveCaseHealth([
      baseCase({
        id: 'case-1',
        suiteId: 'suite-1',
        name: 'Adds an item to the cart',
      }),
      baseCase({
        id: 'case-2',
        suiteId: 'suite-2',
        name: 'Adds an item to the cart',
      }),
    ]);

    expect(health.get('case-1')).not.toContain('near-duplicate-title');
    expect(health.get('case-2')).not.toContain('near-duplicate-title');
  });

  it('never flags a title with no match in the same suite', () => {
    const health = deriveCaseHealth([
      baseCase({
        id: 'case-1',
        suiteId: 'suite-1',
        name: 'Adds an item to the cart',
      }),
      baseCase({
        id: 'case-2',
        suiteId: 'suite-1',
        name: 'Removes an item from the cart',
      }),
    ]);

    expect(health.get('case-1')).not.toContain('near-duplicate-title');
    expect(health.get('case-2')).not.toContain('near-duplicate-title');
  });
});

describe('deriveCaseHealth — combined signals', () => {
  it('reports every signal a case trips at once', () => {
    const health = deriveCaseHealth([
      baseCase({
        id: 'case-1',
        suiteId: 'suite-1',
        name: 'checkout_pay',
        automationKey: 'checkout_pay',
        executionMode: 'automated',
        steps: [],
        hasAnyRun: false,
      }),
    ]);

    expect(health.get('case-1')).toEqual(
      expect.arrayContaining(['no-steps', 'raw-name', 'never-run']),
    );
  });

  it('returns an empty signal list for a healthy case', () => {
    const health = deriveCaseHealth([
      baseCase({
        name: 'Adds an item to the cart',
        executionMode: 'automated',
        steps: ['open', 'add'],
        hasAnyRun: true,
        recentResults: ['pass'],
      }),
    ]);

    expect(health.get('case-1')).toEqual([]);
  });

  it('covers every case passed in, even when none of them trip a signal', () => {
    const health = deriveCaseHealth([
      baseCase({ id: 'case-1' }),
      baseCase({ id: 'case-2', name: 'Removes an item from the cart' }),
    ]);

    expect(health.size).toBe(2);
  });
});
